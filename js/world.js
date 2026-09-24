// World generation: the true land, which the player only sees while standing in it.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, hash2 } = LF;

  const VILLAGE_NAMES = ['the Heron River people', 'the Cedar Hill town', 'the Two Falls people', 'the Red Clay town'];

  function bfsDist(W, H, sources, passable) {
    const dist = new Int16Array(W * H).fill(999);
    const q = [];
    for (const i of sources) { dist[i] = 0; q.push(i); }
    for (let h = 0; h < q.length; h++) {
      const i = q[h], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of LF.N4) {
        const ax = x + dx, ay = y + dy;
        if (!inb(ax, ay)) continue;
        const j = idx(ax, ay);
        if (passable && !passable(j)) continue;
        if (dist[j] > dist[i] + 1) { dist[j] = dist[i] + 1; q.push(j); }
      }
    }
    return dist;
  }

  function generate(seed) {
    const R = LF.rng(seed);
    const n1 = LF.valueNoise(seed * 7 + 1);
    const n2 = LF.valueNoise(seed * 13 + 5);
    const n3 = LF.valueNoise(seed * 3 + 11);
    const n4 = LF.valueNoise(seed * 17 + 23);
    const n5 = LF.valueNoise(seed * 19 + 29);
    const n6 = LF.valueNoise(seed * 23 + 31);

    const N = W * H;
    const elev = new Float32Array(N);
    const moist = new Float32Array(N);
    const t = new Int8Array(N);
    const river = new Uint8Array(N);
    const game = new Uint8Array(N);
    const feat = new Uint8Array(N);

    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const nx = x / W, ny = y / H;
        const coastX = 0.72 + (LF.fbm(n3, ny * 3.2, 0.37, 4) - 0.5) * 0.42;
        let e = (coastX - nx) * 0.78 + (LF.fbm(n1, x / 12, y / 12, 4) - 0.5) * 1.05;
        if (nx > 0.9) e -= (nx - 0.9) * 2;
        elev[idx(x, y)] = e;
        moist[idx(x, y)] = LF.fbm(n2, x / 10, y / 10, 3);
      }

    const sea = [];
    for (let i = 0; i < N; i++) if (elev[i] < 0) sea.push(i);
    const seaDist = bfsDist(W, H, sea);

    for (let i = 0; i < N; i++) {
      const e = elev[i], m = moist[i];
      const x = i % W, y = (i / W) | 0;
      const soil = LF.fbm(n4, x / 7, y / 7, 2);
      const lakeN = LF.fbm(n5, x / 6, y / 6, 2);
      let k;
      if (e < -0.16) k = T.DEEP;
      else if (e < 0) k = T.SEA;
      else if (e < 0.05) k = m > 0.56 ? T.SALTMARSH : T.BEACH;
      else if (e < 0.56) {
        if (lakeN > 0.74 && e > 0.12 && seaDist[i] > 4) k = T.LAKE;
        else if (m > 0.6 && e < 0.28) k = seaDist[i] <= 2 ? T.SALTMARSH : T.SWAMP;
        else if ((seaDist[i] <= 9 && soil > 0.56) || soil > 0.7) k = T.PINE;
        else if (m > 0.46) k = T.FOREST;
        else k = T.MEADOW;
      } else if (e < 0.8) k = T.HILLS;
      else k = T.MOUNTAIN;
      t[i] = k;
    }

    // Rivers run from the high ground to the sea, or into a lake.
    const sources = [];
    for (let tries = 0; tries < 600 && sources.length < 5; tries++) {
      const x = Math.floor(R() * W * 0.6), y = 2 + Math.floor(R() * (H - 4));
      const e = elev[idx(x, y)];
      if (e > 0.4 && e < 1.1 && sources.every((s) => Math.abs(s[0] - x) + Math.abs(s[1] - y) > 13)) sources.push([x, y]);
    }
    const riverPaths = [];
    for (const [sx, sy] of sources) {
      const path = [];
      const seen = new Set();
      let x = sx, y = sy, ok = false;
      for (let step = 0; step < 260; step++) {
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
          let touches = false;
          for (const [ex, ey] of LF.N4) {
            const bx = ax + ex, by = ay + ey;
            if ((bx !== x || by !== y) && inb(bx, by) && seen.has(idx(bx, by))) touches = true;
          }
          if (touches) continue;
          const v = elev[j] - dx * 0.02 + R() * 0.03;
          if (v < be) { be = v; best = [ax, ay]; }
        }
        if (!best) break;
        [x, y] = best;
      }
      if (ok && path.length > 8) {
        for (const i of path) river[i] = 1;
        riverPaths.push(path);
      }
    }
    for (let i = 0; i < N; i++) if (river[i] && t[i] === T.MOUNTAIN) t[i] = T.HILLS;

    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        if (LF.isWoods(t[i]) && LF.fbm(n6, x / 6, y / 6, 2) > 0.57) game[i] = 1;
      }

    const coastDist = seaDist;

    // Features.
    const land = (i) => LF.isLand(t[i]);
    const place = (f, count, ok, spacing) => {
      const placed = [];
      for (let tries = 0; tries < 3000 && placed.length < count; tries++) {
        const x = 1 + Math.floor(R() * (W - 2)), y = 1 + Math.floor(R() * (H - 2));
        const i = idx(x, y);
        if (feat[i] || !land(i) || !ok(x, y, i)) continue;
        if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < (spacing || 6))) continue;
        feat[i] = f;
        placed.push([x, y]);
      }
      return placed;
    };
    const nearT = (x, y, pred, r) => {
      let hit = false;
      LF.around(x, y, r || 1.5, (ax, ay, d, j) => { if (d > 0 && pred(t[j], j)) hit = true; });
      return hit;
    };

    for (const path of riverPaths)
      for (let k = 1; k < path.length - 1; k++) {
        const a = path[k], b = path[k + 1];
        if (elev[a] - elev[b] > 0.07 && !feat[a] && t[a] !== T.MOUNTAIN) {
          feat[a] = F.FALLS;
          k += 6;
        }
      }
    place(F.FORD, 7, (x, y, i) => river[i] && LF.isOpen(t[i]), 5);
    place(F.CLAY, 7, (x, y, i) => river[i] && !LF.isHigh(t[i]), 6);
    place(F.STONE, 9, (x, y, i) => t[i] === T.HILLS && nearT(x, y, (k) => !LF.isHigh(k) && LF.isLand(k)), 6);
    place(F.SPRING, 12, (x, y, i) => !river[i] && (t[i] === T.HILLS || t[i] === T.FOREST || t[i] === T.MEADOW) && nearT(x, y, (k) => k === T.HILLS, 2.5), 5);
    for (const [x, y] of place(F.SALTLICK, 5, (x, y, i) => LF.isWoods(t[i]) || t[i] === T.MEADOW, 9)) LF.around(x, y, 2.5, (ax, ay, d, j) => { if (LF.isWoods(t[j])) game[j] = 1; });
    for (const [x, y] of place(F.BEAVER, 9, (x, y, i) => river[i] && (LF.isWoods(t[i]) || t[i] === T.SWAMP), 5)) LF.around(x, y, 1.5, (ax, ay, d, j) => { if (LF.isWoods(t[j]) || t[j] === T.SWAMP) game[j] = 1; });
    place(F.BERRIES, 10, (x, y, i) => (t[i] === T.MEADOW || t[i] === T.BEACH) && nearT(x, y, (k) => LF.isWoods(k)), 6);
    place(F.IRON, 4, (x, y, i) => t[i] === T.SWAMP, 8);

    // A few bluffs where the high ground meets the sea.
    const bluffs = [];
    const coastCands = [];
    for (let i = 0; i < N; i++) if (land(i) && coastDist[i] === 1 && t[i] !== T.SALTMARSH) coastCands.push(i);
    coastCands.sort((a, b) => elev[b] - elev[a]);
    for (const i of coastCands) {
      if (bluffs.length >= 3) break;
      const x = i % W, y = (i / W) | 0;
      if (bluffs.some(([bx, by]) => Math.hypot(bx - x, by - y) < 10)) continue;
      t[i] = T.HILLS;
      feat[i] = F.CLIFF;
      bluffs.push([x, y]);
    }

    // The landing: a beach or meadow on the coast near the middle of the chart.
    let camp = null, bestScore = -Infinity;
    for (let y = Math.floor(H * 0.3); y < H * 0.7; y++)
      for (let x = Math.floor(W * 0.4); x < W - 2; x++) {
        const i = idx(x, y);
        if (!(t[i] === T.BEACH || t[i] === T.MEADOW) || coastDist[i] !== 1) continue;
        if (!inb(x + 1, y) || !(t[idx(x + 1, y)] === T.SEA || t[idx(x + 1, y)] === T.DEEP)) continue;
        const s = -Math.abs(y - H / 2) * 0.5 + R() * 4 + x * 0.1;
        if (s > bestScore) { bestScore = s; camp = { x, y }; }
      }
    if (!camp) return null;
    feat[idx(camp.x, camp.y)] = 0;
    let ship = { x: camp.x + 1, y: camp.y };
    for (let k = 2; k < 6; k++) if (inb(camp.x + k, camp.y) && LF.isWater(t[idx(camp.x + k, camp.y)])) ship = { x: camp.x + k, y: camp.y };

    // A wreck somewhere down the coast.
    place(F.WRECK, 1, (x, y, i) => t[i] === T.BEACH && coastDist[i] === 1 && Math.hypot(x - camp.x, y - camp.y) > 14, 1);

    // Towns sit inland on good ground, often by a river.
    const villages = [];
    const cands = [];
    for (let y = 4; y < H - 4; y++)
      for (let x = 4; x < W - 4; x++) {
        const i = idx(x, y);
        if (!(t[i] === T.MEADOW || t[i] === T.FOREST)) continue;
        if (coastDist[i] < 5) continue;
        const dc = Math.hypot(x - camp.x, y - camp.y);
        if (dc < 16 || dc > 55) continue;
        const r = LF.N8.some(([dx, dy]) => inb(x + dx, y + dy) && river[idx(x + dx, y + dy)]) ? 1 : 0;
        cands.push({ x, y, s: r * 3 + (t[i] === T.MEADOW ? 1 : 0) + R() * 2.5 });
      }
    cands.sort((a, b) => b.s - a.s);
    for (const c of cands) {
      if (villages.length >= 4) break;
      if (villages.some((v) => Math.hypot(v.x - c.x, v.y - c.y) < 17)) continue;
      villages.push({ id: villages.length, x: c.x, y: c.y, name: VILLAGE_NAMES[villages.length] });
    }
    if (villages.length < 3) return null;

    // Each town keeps fields around it and buries its dead nearby.
    for (const v of villages) {
      LF.around(v.x, v.y, 2.3, (x, y, d, j) => { if (t[j] === T.MEADOW || LF.isWoods(t[j])) t[j] = T.OLDFIELD; });
      feat[idx(v.x, v.y)] = 0;
      for (let tries = 0; tries < 40; tries++) {
        const a = R() * Math.PI * 2, r = 3 + R() * 1.5;
        const bx = Math.round(v.x + Math.cos(a) * r), by = Math.round(v.y + Math.sin(a) * r);
        if (inb(bx, by) && land(idx(bx, by)) && !river[idx(bx, by)]) { feat[idx(bx, by)] = F.BURIAL; break; }
      }
      let sea = 0, woods = 0;
      LF.around(v.x, v.y, 7, (x, y, d, j) => { if (LF.isWater(t[j])) sea++; if (game[j]) woods++; });
      v.economy = sea > 12 ? 'fish' : woods > 18 ? 'furs' : 'corn';
      v.size = 120 + Math.floor(R() * 280);
    }

    // An empty town, abandoned after a sickness. Good ground, and not without its dead.
    let ruin = null;
    const ruinCands = cands.filter((c) => villages.every((v) => Math.hypot(v.x - c.x, v.y - c.y) > 13) && Math.hypot(c.x - camp.x, c.y - camp.y) > 10);
    if (ruinCands.length) {
      ruin = ruinCands[Math.floor(R() * Math.min(6, ruinCands.length))];
      LF.around(ruin.x, ruin.y, 2.6, (x, y, d, j) => { if (t[j] === T.MEADOW || LF.isWoods(t[j])) t[j] = T.OLDFIELD; });
      feat[idx(ruin.x, ruin.y)] = F.RUIN;
      for (const [dx, dy] of [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [0, 3]]) {
        const bx = ruin.x + dx, by = ruin.y + dy;
        if (inb(bx, by) && land(idx(bx, by)) && !river[idx(bx, by)]) { feat[idx(bx, by)] = F.BURIAL; break; }
      }
    }

    const vs = villages.map((v, k) => ({
      ...v,
      relation: 0,
      contacted: false,
      promised: false,
      promiseBroken: false,
      territoryKnown: false,
      radius: 8,
      rival: (k ^ 1) < villages.length ? k ^ 1 : null,
      memory: [],
      guideGiven: false,
      taught: false,
    }));

    return { seed, t, elev, moist, river, game, feat, seaDist: coastDist, camp, ship, villages: vs, ruin };
  }

  LF.generateWorld = function (seed) {
    for (let k = 0; k < 60; k++) {
      const w = generate(seed + k * 101);
      if (w && w.villages.length >= 3) { w.seed = seed; return w; }
    }
    return generate(seed);
  };

  // How sheltered a stretch of coast is: the share of land around the nearest salt water.
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
    if (!best) return { coastal: false, shelter: 0, deep: false };
    let land = 0, tot = 0, deep = false;
    for (let dy = -5; dy <= 5; dy++)
      for (let dx = -5; dx <= 5; dx++) {
        const ax = best[0] + dx, ay = best[1] + dy;
        if (!inb(ax, ay) || dx * dx + dy * dy > 25) continue;
        tot++;
        const k = t[idx(ax, ay)];
        if (k >= T.BEACH) land++;
        if (k === T.DEEP && dx * dx + dy * dy <= 9) deep = true;
      }
    return { coastal: true, shelter: land / tot, deep };
  };
})();
