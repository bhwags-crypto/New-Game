// World generation: the true land, which the player only sees while standing in it.
(function () {
  const LF = (window.LF = window.LF || {});

  const W = (LF.W = 72);
  const H = (LF.H = 52);

  const T = (LF.T = {
    DEEP: 0,
    SEA: 1,
    BEACH: 2,
    MEADOW: 3,
    FOREST: 4,
    SWAMP: 5,
    HILLS: 6,
    MOUNTAIN: 7,
  });

  LF.T_NAME = ['Deep water', 'Shallows', 'Beach', 'Meadow', 'Forest', 'Swamp', 'Hills', 'Mountains'];
  LF.T_COST = [99, 99, 2, 2, 3, 5, 4, 7];
  LF.isWater = (t) => t === T.DEEP || t === T.SEA;

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  LF.rng = mulberry32;

  function hash2(x, y, s) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  LF.hash2 = hash2;

  function valueNoise(seed) {
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
      const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  }
  function fbm(n, x, y, oct) {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
      s += n(x * f, y * f) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / tot;
  }

  const idx = (LF.idx = (x, y) => y * W + x);
  const inb = (LF.inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H);
  LF.N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  LF.N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  const VILLAGE_NAMES = [
    'the Heron River people',
    'the Cedar Hill town',
    'the Two Falls people',
    'the Red Clay town',
  ];

  function generate(seed) {
    const R = mulberry32(seed);
    const n1 = valueNoise(seed * 7 + 1);
    const n2 = valueNoise(seed * 13 + 5);
    const n3 = valueNoise(seed * 3 + 11);
    const n4 = valueNoise(seed * 17 + 23);

    const elev = new Float32Array(W * H);
    const moist = new Float32Array(W * H);
    const t = new Int8Array(W * H);
    const river = new Uint8Array(W * H);
    const game = new Uint8Array(W * H);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;
        const coastX = 0.7 + (fbm(n3, ny * 3.2, 0.37, 4) - 0.5) * 0.42;
        let e = (coastX - nx) * 0.9 + (fbm(n1, x / 11, y / 11, 4) - 0.5) * 1.05;
        // Pull the map edges down a little so the east is reliably open sea.
        if (nx > 0.9) e -= (nx - 0.9) * 2;
        elev[idx(x, y)] = e;
        moist[idx(x, y)] = fbm(n2, x / 9, y / 9, 3);
      }
    }

    for (let i = 0; i < W * H; i++) {
      const e = elev[i], m = moist[i];
      let k;
      if (e < -0.16) k = T.DEEP;
      else if (e < 0) k = T.SEA;
      else if (e < 0.045) k = m > 0.6 ? T.SWAMP : T.BEACH;
      else if (e < 0.5) {
        if (m > 0.58 && e < 0.3) k = T.SWAMP;
        else if (m > 0.46) k = T.FOREST;
        else k = T.MEADOW;
      } else if (e < 0.74) k = T.HILLS;
      else k = T.MOUNTAIN;
      t[i] = k;
    }

    // Rivers run from the high ground downhill to the sea.
    const sources = [];
    for (let tries = 0; tries < 400 && sources.length < 4; tries++) {
      const x = Math.floor(R() * W * 0.55), y = 2 + Math.floor(R() * (H - 4));
      const e = elev[idx(x, y)];
      if (e > 0.55 && e < 1.0 && sources.every((s) => Math.abs(s[0] - x) + Math.abs(s[1] - y) > 12)) sources.push([x, y]);
    }
    for (const [sx, sy] of sources) {
      const path = [];
      const seen = new Set();
      let x = sx, y = sy, ok = false;
      for (let step = 0; step < 220; step++) {
        const i = idx(x, y);
        if (LF.isWater(t[i])) { ok = true; break; }
        if (river[i] && step > 0) { ok = true; break; }
        path.push(i);
        seen.add(i);
        let best = null, be = Infinity;
        for (const [dx, dy] of LF.N4) {
          const ax = x + dx, ay = y + dy;
          if (!inb(ax, ay)) continue;
          const j = idx(ax, ay);
          if (seen.has(j)) continue;
          // Never run alongside our own earlier course, which is what makes blobs.
          let touches = false;
          for (const [ex, ey] of LF.N4) {
            const bx = ax + ex, by = ay + ey;
            if ((bx !== x || by !== y) && inb(bx, by) && seen.has(idx(bx, by))) touches = true;
          }
          if (touches) continue;
          // A slight eastward pull keeps rivers from pooling in basins forever.
          const v = elev[j] - dx * 0.02 + R() * 0.03;
          if (v < be) { be = v; best = [ax, ay]; }
        }
        if (!best) break;
        [x, y] = best;
      }
      if (ok && path.length > 6) for (const i of path) river[i] = 1;
    }
    for (let i = 0; i < W * H; i++) if (river[i] && t[i] === T.MOUNTAIN) t[i] = T.HILLS;

    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (t[i] === T.FOREST && fbm(n4, x / 6, y / 6, 2) > 0.58) game[i] = 1;
      }

    // Distance from salt water, used to place the landing and the villages.
    const seaDist = new Int16Array(W * H).fill(999);
    const q = [];
    for (let i = 0; i < W * H; i++) if (LF.isWater(t[i])) { seaDist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of LF.N4) {
        const ax = x + dx, ay = y + dy;
        if (!inb(ax, ay)) continue;
        const j = idx(ax, ay);
        if (seaDist[j] > seaDist[i] + 1) { seaDist[j] = seaDist[i] + 1; q.push(j); }
      }
    }

    // The landing: a beach or meadow on the coast, near the middle of the chart.
    let camp = null, bestScore = -Infinity;
    for (let y = Math.floor(H * 0.3); y < H * 0.7; y++)
      for (let x = Math.floor(W * 0.4); x < W - 2; x++) {
        const i = idx(x, y);
        if (!(t[i] === T.BEACH || t[i] === T.MEADOW) || seaDist[i] !== 1) continue;
        // The ship needs open water to the east of the landing.
        if (!inb(x + 1, y) || !LF.isWater(t[idx(x + 1, y)])) continue;
        const s = -Math.abs(y - H / 2) * 0.5 + R() * 4 + x * 0.1;
        if (s > bestScore) { bestScore = s; camp = { x, y }; }
      }
    if (!camp) return null;
    let ship = { x: camp.x + 1, y: camp.y };
    for (let k = 2; k < 5; k++) if (inb(camp.x + k, camp.y) && LF.isWater(t[idx(camp.x + k, camp.y)])) ship = { x: camp.x + k, y: camp.y };

    // Villages sit inland on good ground, often by a river.
    const villages = [];
    const cands = [];
    for (let y = 3; y < H - 3; y++)
      for (let x = 3; x < W - 3; x++) {
        const i = idx(x, y);
        if (!(t[i] === T.MEADOW || t[i] === T.FOREST)) continue;
        if (seaDist[i] < 4) continue;
        const dc = Math.hypot(x - camp.x, y - camp.y);
        if (dc < 11 || dc > 40) continue;
        let r = 0;
        for (const [dx, dy] of LF.N8) if (inb(x + dx, y + dy) && river[idx(x + dx, y + dy)]) r = 1;
        cands.push({ x, y, s: r * 3 + (t[i] === T.MEADOW ? 1 : 0) + R() * 2.5 });
      }
    cands.sort((a, b) => b.s - a.s);
    for (const c of cands) {
      if (villages.length >= 3) break;
      if (villages.some((v) => Math.hypot(v.x - c.x, v.y - c.y) < 15)) continue;
      villages.push({
        id: villages.length,
        x: c.x,
        y: c.y,
        name: VILLAGE_NAMES[villages.length],
        relation: 0,
        contacted: false,
        promised: false,
        territoryKnown: false,
        radius: 6,
      });
    }

    return { seed, t, elev, river, game, seaDist, camp, ship, villages };
  }

  LF.generateWorld = function (seed) {
    for (let k = 0; k < 50; k++) {
      const w = generate(seed + k * 101);
      if (w && w.villages.length >= 3) { w.seed = seed; return w; }
    }
    return generate(seed);
  };

  // How sheltered a stretch of coast is: the share of land around the nearest water.
  LF.harborShelter = function (t, x, y) {
    let best = null, bd = Infinity;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const ax = x + dx, ay = y + dy;
        if (!inb(ax, ay)) continue;
        const k = t[idx(ax, ay)];
        if (k === T.SEA || k === T.DEEP) {
          const d = Math.hypot(dx, dy);
          if (d < bd) { bd = d; best = [ax, ay]; }
        }
      }
    if (!best) return { coastal: false, shelter: 0 };
    let land = 0, tot = 0;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const ax = best[0] + dx, ay = best[1] + dy;
        if (!inb(ax, ay) || dx * dx + dy * dy > 16) continue;
        tot++;
        const k = t[idx(ax, ay)];
        if (k >= 0 && !(k === T.SEA || k === T.DEEP)) land++;
      }
    return { coastal: true, shelter: land / tot };
  };
})();
