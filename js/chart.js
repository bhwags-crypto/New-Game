// The map table: draws the colony's hand-made chart. It never reads the true world
// unless asked to paint the truth for the epilogue.
(function () {
  const LF = window.LF;
  const { T, F, W, H, hash2, idx, inb } = LF;

  const INK = [59, 42, 26];
  const DOUBT = [176, 62, 34];
  const PENCIL = [98, 96, 94];
  const VILLAGER = [52, 84, 72];
  const SEAL = '#9b2a22';
  const WASH = '120,150,140';

  const rgbs = (c) => `${c[0]},${c[1]},${c[2]}`;
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(Math.round);

  let parchment = null;
  function parchmentTexture() {
    if (parchment) return parchment;
    const c = document.createElement('canvas');
    const S = 11;
    c.width = W * S;
    c.height = H * S;
    const g = c.getContext('2d');
    g.fillStyle = '#e6d6b0';
    g.fillRect(0, 0, c.width, c.height);
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
        const ex = Math.min(x, c.width - x, y, c.height - y);
        const v = hash2(x, y, 3) * 9 + (ex < 40 ? (40 - ex) * 0.9 : 0);
        d[k] -= v;
        d[k + 1] -= v * 1.1;
        d[k + 2] -= v * 1.4;
      }
    g.putImageData(img, 0, 0);
    parchment = c;
    return c;
  }

  // A knowledge layer: what the colony believes about each square.
  LF.newKnowledge = function () {
    const N = W * H;
    return {
      t: new Int8Array(N).fill(-1),
      q: new Float32Array(N),
      seen: new Int16Array(N),
      river: new Uint8Array(N),
      game: new Uint8Array(N),
      feat: new Uint8Array(N),
      src: new Uint8Array(N),
    };
  };

  function line(g, pts) {
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.stroke();
  }

  function tuft(g, cx, cy, s) {
    line(g, [cx, cy, cx - s * 0.08, cy - s * 0.2]);
    line(g, [cx, cy, cx, cy - s * 0.25]);
    line(g, [cx, cy, cx + s * 0.08, cy - s * 0.2]);
  }

  function glyph(g, kind, px, py, s, x, y, col, a) {
    const r = (k) => hash2(x, y, k);
    g.strokeStyle = `rgba(${col},${a})`;
    g.fillStyle = `rgba(${col},${a})`;
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
    } else if (kind === T.PINE) {
      const n = small ? 1 : 2 + (r(1) > 0.6 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const cx = px + s * (0.2 + 0.6 * r(10 + i)), cy = py + s * (0.3 + 0.45 * r(20 + i));
        line(g, [cx - s * 0.12, cy + s * 0.1, cx, cy - s * 0.25, cx + s * 0.12, cy + s * 0.1, cx - s * 0.12, cy + s * 0.1]);
        line(g, [cx, cy + s * 0.1, cx, cy + s * 0.22]);
      }
    } else if (kind === T.MEADOW) {
      for (let i = 0; i < (small ? 1 : 3); i++) {
        const cx = px + s * (0.15 + 0.7 * r(30 + i)), cy = py + s * (0.2 + 0.6 * r(40 + i));
        g.fillRect(cx, cy, Math.max(0.8, s / 18), Math.max(0.8, s / 18));
      }
      if (!small && r(5) > 0.55) tuft(g, px + s * 0.5, py + s * 0.7, s * 0.8);
    } else if (kind === T.OLDFIELD) {
      g.lineWidth = Math.max(0.5, s / 20);
      for (let i = 0; i < (small ? 2 : 4); i++) {
        const yy = py + s * (0.2 + i * 0.2);
        line(g, [px + s * 0.15, yy, px + s * 0.85, yy - s * 0.08]);
      }
    } else if (kind === T.SWAMP) {
      for (let i = 0; i < (small ? 1 : 2); i++) {
        const cx = px + s * (0.15 + 0.5 * r(50 + i)), cy = py + s * (0.25 + 0.55 * r(60 + i));
        line(g, [cx, cy, cx + s * 0.3, cy]);
      }
      if (!small) {
        tuft(g, px + s * (0.3 + 0.4 * r(7)), py + s * 0.55, s);
        tuft(g, px + s * (0.1 + 0.3 * r(8)), py + s * 0.9, s * 0.7);
      }
    } else if (kind === T.SALTMARSH) {
      g.lineWidth = Math.max(0.5, s / 22);
      for (let i = 0; i < (small ? 2 : 4); i++) {
        const cx = px + s * (0.1 + 0.55 * r(50 + i)), cy = py + s * (0.2 + 0.65 * r(60 + i));
        line(g, [cx, cy, cx + s * 0.25, cy]);
      }
      if (!small && r(9) > 0.5) tuft(g, px + s * 0.6, py + s * 0.6, s * 0.7);
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
      for (let i = 0; i < (small ? 2 : 5); i++) g.fillRect(px + s * r(70 + i), py + s * r(80 + i), Math.max(0.6, s / 22), Math.max(0.6, s / 22));
    }
  }

  // Small symbols for things found on the land.
  function featGlyph(g, f, cx, cy, s, col, a) {
    const u = Math.max(4, s * 0.42);
    g.save();
    g.strokeStyle = `rgba(${col},${a})`;
    g.fillStyle = `rgba(${col},${a})`;
    g.lineWidth = Math.max(1, s / 12);
    // A small clear ground under the symbol so it reads over terrain.
    g.fillStyle = `rgba(230,214,176,${0.8 * a})`;
    g.beginPath();
    g.arc(cx, cy, u * 1.05, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(${col},${a})`;
    switch (f) {
      case F.SPRING:
        g.beginPath(); g.arc(cx, cy, u * 0.55, 0, Math.PI * 2); g.stroke();
        g.beginPath(); g.arc(cx, cy, u * 0.18, 0, Math.PI * 2); g.fill();
        break;
      case F.CLAY:
        g.beginPath(); g.moveTo(cx - u * 0.5, cy - u * 0.4); g.quadraticCurveTo(cx - u * 0.7, cy + u * 0.6, cx, cy + u * 0.6); g.quadraticCurveTo(cx + u * 0.7, cy + u * 0.6, cx + u * 0.5, cy - u * 0.4); g.stroke();
        line(g, [cx - u * 0.55, cy - u * 0.4, cx + u * 0.55, cy - u * 0.4]);
        break;
      case F.STONE:
        g.strokeRect(cx - u * 0.55, cy - u * 0.3, u * 0.6, u * 0.55);
        g.strokeRect(cx - u * 0.05, cy - u * 0.05, u * 0.6, u * 0.5);
        break;
      case F.SALTLICK:
        line(g, [cx - u * 0.5, cy - u * 0.5, cx + u * 0.5, cy + u * 0.5]);
        line(g, [cx + u * 0.5, cy - u * 0.5, cx - u * 0.5, cy + u * 0.5]);
        break;
      case F.BEAVER:
        for (let i = -1; i <= 1; i++) line(g, [cx - u * 0.6, cy + i * u * 0.3, cx + u * 0.6, cy + i * u * 0.3 - u * 0.1]);
        break;
      case F.FALLS:
        line(g, [cx - u * 0.5, cy - u * 0.5, cx, cy - u * 0.05, cx + u * 0.5, cy - u * 0.5]);
        line(g, [cx - u * 0.5, cy + u * 0.05, cx, cy + u * 0.5, cx + u * 0.5, cy + u * 0.05]);
        break;
      case F.FORD:
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(cx + i * u * 0.4, cy, u * 0.12, 0, Math.PI * 2); g.fill(); }
        break;
      case F.CLIFF:
        for (let i = -2; i <= 2; i++) line(g, [cx + i * u * 0.25, cy - u * 0.5, cx + i * u * 0.25 + u * 0.1, cy + u * 0.4]);
        line(g, [cx - u * 0.65, cy - u * 0.5, cx + u * 0.65, cy - u * 0.5]);
        break;
      case F.BURIAL:
        g.beginPath(); g.moveTo(cx - u * 0.7, cy + u * 0.35); g.quadraticCurveTo(cx, cy - u * 0.7, cx + u * 0.7, cy + u * 0.35); g.stroke();
        for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(cx + i * u * 0.28, cy + u * 0.05, u * 0.08, 0, Math.PI * 2); g.fill(); }
        break;
      case F.BERRIES:
        for (const [dx, dy] of [[-0.25, 0.1], [0.2, 0.15], [0, -0.2]]) { g.beginPath(); g.arc(cx + dx * u, cy + dy * u, u * 0.2, 0, Math.PI * 2); g.fill(); }
        break;
      case F.IRON:
        g.fillRect(cx - u * 0.55, cy - u * 0.15, u * 1.1, u * 0.3);
        g.fillRect(cx - u * 0.2, cy + u * 0.15, u * 0.4, u * 0.35);
        break;
      case F.WRECK:
        g.beginPath(); g.moveTo(cx - u * 0.7, cy); g.quadraticCurveTo(cx, cy + u * 0.7, cx + u * 0.7, cy); g.stroke();
        for (let i = -1; i <= 1; i++) line(g, [cx + i * u * 0.35, cy + u * 0.2, cx + i * u * 0.3, cy - u * 0.45]);
        break;
      case F.RUIN:
        g.beginPath(); g.moveTo(cx - u * 0.6, cy + u * 0.4); g.quadraticCurveTo(cx - u * 0.2, cy - u * 0.5, cx + u * 0.1, cy - u * 0.2); g.stroke();
        line(g, [cx + u * 0.25, cy - u * 0.05, cx + u * 0.6, cy + u * 0.4]);
        break;
    }
    g.restore();
  }
  LF.featGlyph = featGlyph;

  function lodge(g, cx, cy, s, col, a) {
    g.strokeStyle = `rgba(${col},${a})`;
    g.fillStyle = `rgba(${col},${a * 0.15})`;
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
    g.strokeStyle = `rgba(${rgbs(INK)},0.95)`;
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
    const r = Math.max(8, s * 0.6);
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

  function star(g, cx, cy, r, fill) {
    g.fillStyle = fill;
    g.strokeStyle = 'rgba(40,25,10,0.9)';
    g.lineWidth = 1.2;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      const x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }

  function label(g, text, x, y, size, a, italic) {
    g.font = `${italic ? 'italic ' : ''}${size}px "IM Fell English", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 3;
    g.strokeStyle = `rgba(230,214,176,${a * 0.9})`;
    g.strokeText(text, x, y);
    g.fillStyle = `rgba(${rgbs(INK)},${a})`;
    g.fillText(text, x, y);
  }
  LF.chartLabel = label;

  // Ink colour for a square: dark and sure, or red where the surveyor doubted.
  function inkFor(K, i, base) {
    if (base !== INK) return base;
    if (K.src[i] === 1) return VILLAGER;
    const t = LF.clamp((0.86 - K.q[i]) / 0.3, 0, 1);
    return mix(INK, DOUBT, t);
  }

  function drawLayer(g, K, cam, day, base, isPencil) {
    const s = cam.s;
    const cw = g.canvas.width / cam.dpr, ch = g.canvas.height / cam.dpr;
    const x0 = Math.max(0, Math.floor(-cam.ox / s) - 1), x1 = Math.min(W, Math.ceil((cw - cam.ox) / s) + 1);
    const y0 = Math.max(0, Math.floor(-cam.oy / s) - 1), y1 = Math.min(H, Math.ceil((ch - cam.oy) / s) + 1);
    const alphaOf = (i) => {
      const fade = isPencil ? 0.9 : Math.max(0.35, 1 - (day - K.seen[i]) / 60);
      return (0.55 + 0.45 * K.q[i]) * fade;
    };
    const isWet = (i) => LF.isWater(K.t[i]);

    // Water washes.
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        const k = K.t[i];
        if (!LF.isWater(k)) continue;
        const px = cam.ox + x * s, py = cam.oy + y * s;
        const tone = k === T.LAKE ? '105,140,150' : isPencil ? rgbs(PENCIL) : WASH;
        g.fillStyle = `rgba(${tone},${isPencil ? 0.12 : 0.16})`;
        g.fillRect(px, py, s + 0.5, s + 0.5);
        let nearLand = false;
        for (const [dx, dy] of LF.N8) if (inb(x + dx, y + dy) && LF.isLand(K.t[idx(x + dx, y + dy)])) nearLand = true;
        if (nearLand && s >= 7 && k !== T.LAKE) {
          g.strokeStyle = `rgba(${rgbs(inkFor(K, i, base))},${0.35 * alphaOf(i)})`;
          g.lineWidth = Math.max(0.5, s / 22);
          const yy = py + s * (0.35 + 0.3 * hash2(x, y, 12));
          g.beginPath();
          g.moveTo(px + s * 0.15, yy);
          g.quadraticCurveTo(px + s * 0.35, yy - s * 0.12, px + s * 0.5, yy);
          g.quadraticCurveTo(px + s * 0.65, yy + s * 0.12, px + s * 0.85, yy);
          g.stroke();
        }
      }

    // Shorelines by marching squares between square centres.
    g.lineCap = 'round';
    const SEGS = { 1: ['LB'], 2: ['BR'], 3: ['LR'], 4: ['TR'], 5: ['LT', 'BR'], 6: ['TB'], 7: ['LT'], 8: ['LT'], 9: ['TB'], 10: ['TR', 'LB'], 11: ['TR'], 12: ['LR'], 13: ['BR'], 14: ['LB'] };
    for (let y = y0 - 1; y < y1; y++)
      for (let x = x0 - 1; x < x1; x++) {
        if (!inb(x, y) || !inb(x + 1, y + 1)) continue;
        const ids = [idx(x, y), idx(x + 1, y), idx(x + 1, y + 1), idx(x, y + 1)];
        if (ids.some((i) => K.t[i] < 0)) continue;
        const land = ids.map((i) => (isWet(i) ? 0 : 1));
        const code = land[0] * 8 + land[1] * 4 + land[2] * 2 + land[3];
        if (code === 0 || code === 15) continue;
        const a = Math.min(...ids.map(alphaOf));
        const col = rgbs(inkFor(K, ids[land.indexOf(1)], base));
        const cx = cam.ox + (x + 0.5) * s, cy = cam.oy + (y + 0.5) * s;
        const jit = (ex, ey) => (hash2(ex, ey, 77) - 0.5) * s * 0.35;
        const P = {
          T: [cx + s * 0.5 + jit(2 * x + 1, 2 * y), cy + jit(2 * x + 1, 2 * y + 900)],
          R: [cx + s + jit(2 * x + 2, 2 * y + 1), cy + s * 0.5 + jit(2 * x + 2, 2 * y + 901)],
          B: [cx + s * 0.5 + jit(2 * x + 1, 2 * y + 2), cy + s + jit(2 * x + 1, 2 * y + 902)],
          L: [cx + jit(2 * x, 2 * y + 1), cy + s * 0.5 + jit(2 * x, 2 * y + 901)],
        };
        const SEG = SEGS[code];
        g.strokeStyle = `rgba(${col},${0.9 * a})`;
        g.lineWidth = Math.max(1, s / 8);
        for (const sg of SEG) line(g, [...P[sg[0]], ...P[sg[1]]]);
        if (s >= 8) {
          g.strokeStyle = `rgba(${col},${0.3 * a})`;
          g.lineWidth = Math.max(0.6, s / 18);
          const corners = [[cx, cy], [cx + s, cy], [cx + s, cy + s], [cx, cy + s]];
          let sx = 0, sy = 0, n = 0;
          corners.forEach((c, k) => { if (!land[k]) { sx += c[0]; sy += c[1]; n++; } });
          const off = (pt) => {
            const tx = sx / n - pt[0], ty = sy / n - pt[1];
            const len = Math.hypot(tx, ty) || 1;
            return [pt[0] + (tx / len) * s * 0.22, pt[1] + (ty / len) * s * 0.22];
          };
          for (const sg of SEG) line(g, [...off(P[sg[0]]), ...off(P[sg[1]])]);
        }
      }
    g.lineCap = 'butt';

    // Terrain.
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        const k = K.t[i];
        if (!LF.isLand(k)) continue;
        const a = alphaOf(i);
        const col = rgbs(inkFor(K, i, base));
        const px = cam.ox + x * s, py = cam.oy + y * s;
        if (!isPencil && K.q[i] < 0.7 && K.src[i] !== 1) {
          g.fillStyle = `rgba(${rgbs(DOUBT)},${0.07 * a})`;
          g.fillRect(px, py, s + 0.5, s + 0.5);
        }
        glyph(g, k, px, py, s, x, y, col, a);
        if (K.game[i] && s >= 9 && hash2(x, y, 33) > 0.65) {
          g.fillStyle = `rgba(${col},${a})`;
          g.font = `${Math.round(s * 0.5)}px Georgia, serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('❧', px + s * 0.78, py + s * 0.3);
        }
      }

    // Rivers.
    g.lineCap = 'round';
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = idx(x, y);
        if (!K.river[i] || K.t[i] < 0) continue;
        const a = alphaOf(i);
        const cx = cam.ox + (x + 0.5) * s, cy = cam.oy + (y + 0.5) * s;
        g.strokeStyle = isPencil ? `rgba(${rgbs(PENCIL)},${0.95 * a})` : `rgba(52,74,92,${0.95 * a})`;
        g.lineWidth = Math.max(1.2, s / 6);
        let any = false;
        for (const [dx, dy] of LF.N4) {
          const ax = x + dx, ay = y + dy;
          if (!inb(ax, ay)) continue;
          const j = idx(ax, ay);
          if (!K.river[j] && !isWet(j)) continue;
          any = true;
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

    // Features.
    if (s >= 5)
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = idx(x, y);
          if (!K.feat[i] || K.t[i] < 0) continue;
          featGlyph(g, K.feat[i], cam.ox + (x + 0.5) * s, cam.oy + (y + 0.5) * s, s, rgbs(inkFor(K, i, base)), alphaOf(i));
        }
  }

  function compass(g, cx, cy, r) {
    g.save();
    g.translate(cx, cy);
    g.strokeStyle = `rgba(${rgbs(INK)},0.7)`;
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
      g.fillStyle = k === 0 ? SEAL : `rgba(${rgbs(INK)},${k % 2 ? 0.45 : 0.8})`;
      g.fill();
    }
    g.fillStyle = `rgba(${rgbs(INK)},0.9)`;
    g.font = `${Math.round(r * 0.45)}px "IM Fell English SC", Georgia, serif`;
    g.textAlign = 'center';
    g.textBaseline = 'bottom';
    g.fillText('N', 0, -r * 1.02);
    g.restore();
  }

  function truthKnowledge(world) {
    const K = LF.newKnowledge();
    K.t.set(world.t);
    K.q.fill(1);
    K.river.set(world.river);
    K.game.set(world.game);
    K.feat.set(world.feat);
    return K;
  }

  // opts: { K, notes, day, cam, villages, sites, camp, party, title, truth, highlight, marks }
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

    const K = opts.truth ? truthKnowledge(opts.truth) : opts.K;
    drawLayer(g, K, cam, opts.day, opts.truth ? [70, 40, 30] : INK, false);
    if (opts.notes && !opts.truth) drawLayer(g, opts.notes, cam, opts.day, PENCIL, true);

    if (!opts.truth) {
      let unknown = 0, sx = 0, sy = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W * 0.5; x++)
          if (K.t[idx(x, y)] < 0 && !(opts.notes && opts.notes.t[idx(x, y)] >= 0)) { unknown++; sx += x; sy += y; }
      if (unknown > 200) {
        g.save();
        g.translate(cam.ox + (sx / unknown) * s, cam.oy + (sy / unknown) * s);
        g.rotate(-0.12);
        label(g, 'Terra Incognita', 0, 0, Math.max(13, s * 2), 0.55, true);
        g.restore();
      }
    }

    // Towns and their hunting grounds.
    for (const v of opts.villages || []) {
      const d = opts.truth ? v : v.drawn;
      if (!d || !(opts.truth || v.territoryKnown)) continue;
      const cx = cam.ox + (d.x + 0.5) * s, cy = cam.oy + (d.y + 0.5) * s;
      g.setLineDash([s * 0.6, s * 0.4]);
      g.strokeStyle = 'rgba(155,42,34,0.65)';
      g.lineWidth = Math.max(1, s / 10);
      g.beginPath();
      g.arc(cx, cy, v.radius * s, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
      if (s >= 6) label(g, v.promised ? 'hunting grounds (promised)' : 'hunting grounds', cx, cy + (v.radius - 0.9) * s, Math.max(10, s * 0.9), 0.75, true);
    }
    for (const v of opts.villages || []) {
      const d = opts.truth ? v : v.drawn || (opts.notes ? v.pencil : null);
      if (!d) continue;
      const cx = cam.ox + (d.x + 0.5) * s, cy = cam.oy + (d.y + 0.5) * s;
      lodge(g, cx, cy, Math.max(8, s * 0.95), rgbs(INK), v.drawn || opts.truth ? 0.95 : 0.6);
      if (s >= 5) label(g, v.contacted || opts.truth ? LF.cap(v.name) : 'a town', cx, cy + Math.max(11, s * 1.2), Math.max(11, s * 1.0), 0.9, true);
    }

    if (opts.camp) {
      const cx = cam.ox + (opts.camp.x + 0.5) * s, cy = cam.oy + (opts.camp.y + 0.5) * s;
      flag(g, cx, cy, Math.max(10, s * 1.2));
      if (s >= 5) label(g, 'The Landing', cx - Math.max(30, s * 2.6), cy, Math.max(11, s * 1.05), 0.95, true);
    }

    for (const site of opts.sites || []) {
      if (site.isLanding) continue;
      const cx = cam.ox + (site.x + 0.5) * s, cy = cam.oy + (site.y + 0.5) * s;
      seal(g, cx, cy, s, site.letter);
      if (s >= 6) label(g, site.name, cx, cy - Math.max(15, s * 1.3), Math.max(11, s * 0.95), 0.95, false);
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
      g.setLineDash([5, 4]);
      g.beginPath();
      g.arc(cam.ox + (h.x + 0.5) * s, cam.oy + (h.y + 0.5) * s, h.r * s, 0, Math.PI * 2);
      g.stroke();
      g.setLineDash([]);
    }

    for (const m of opts.marks || []) {
      const cx = cam.ox + (m.x + 0.5) * s, cy = cam.oy + (m.y + 0.5) * s;
      star(g, cx, cy, Math.max(9, s * 0.9), m.color || '#e0bb6c');
      if (m.label) label(g, m.label, cx, cy + Math.max(16, s * 1.5), Math.max(11, s * 0.95), 1, false);
    }

    if (opts.party) {
      const p = opts.party;
      const cx = cam.ox + (p.x + p.drift.x + 0.5) * s, cy = cam.oy + (p.y + p.drift.y + 0.5) * s;
      g.strokeStyle = SEAL;
      g.lineWidth = 2.5;
      const r = Math.max(6, s * 0.55);
      line(g, [cx - r, cy - r, cx + r, cy + r]);
      line(g, [cx + r, cy - r, cx - r, cy + r]);
      label(g, 'our reckoning', cx, cy + r + 11, 12, 0.9, true);
    }
    g.restore();

    g.strokeStyle = `rgba(${rgbs(INK)},0.8)`;
    g.lineWidth = 2;
    g.strokeRect(cam.ox + 6, cam.oy + 6, W * s - 12, H * s - 12);
    g.lineWidth = 0.8;
    g.strokeRect(cam.ox + 10, cam.oy + 10, W * s - 20, H * s - 20);
    const cr = Math.max(18, s * 2.4);
    compass(g, cam.ox + W * s - cr * 1.8, cam.oy + H * s - cr * 1.8, cr);
    const bx = cam.ox + 24, by = cam.oy + H * s - 22;
    const five = 5 / LF.MILES_PER_TILE;
    g.strokeStyle = `rgba(${rgbs(INK)},0.9)`;
    g.lineWidth = 1.2;
    line(g, [bx, by, bx + five * s, by]);
    for (let k = 0; k <= 5; k++) line(g, [bx + (k * five * s) / 5, by - (k % 5 ? 3 : 5), bx + (k * five * s) / 5, by]);
    g.fillStyle = `rgba(${rgbs(INK)},0.9)`;
    g.font = `${Math.max(10, Math.round(s * 0.9))}px "IM Fell English", Georgia, serif`;
    g.textAlign = 'left';
    g.textBaseline = 'bottom';
    g.fillText('Five miles', bx, by - 6);
    if (opts.title) {
      g.textAlign = 'left';
      g.textBaseline = 'top';
      g.font = `${Math.max(13, Math.round(s * 1.2))}px "IM Fell English SC", Georgia, serif`;
      g.fillText(opts.title, cam.ox + 22, cam.oy + 20);
    }
  };
})();
