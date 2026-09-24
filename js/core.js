// Shared constants and helpers.
(function () {
  const LF = (window.LF = window.LF || {});

  // Each square on the chart is half a mile across.
  const W = (LF.W = 80);
  const H = (LF.H = 60);
  LF.MILES_PER_TILE = 0.5;
  LF.ACRES_PER_TILE = 160;

  const T = (LF.T = {
    DEEP: 0,
    SEA: 1,
    LAKE: 2,
    BEACH: 3,
    SALTMARSH: 4,
    MEADOW: 5,
    OLDFIELD: 6,
    FOREST: 7,
    PINE: 8,
    SWAMP: 9,
    HILLS: 10,
    MOUNTAIN: 11,
  });
  LF.T_NAME = ['Deep water', 'Shallows', 'Lake', 'Beach', 'Salt marsh', 'Meadow', 'Old fields', 'Hardwood forest', 'Pine barrens', 'Swamp', 'Hills', 'Mountains'];
  LF.T_SHORT = ['deep water', 'shallows', 'lake', 'beach', 'salt marsh', 'meadow', 'old fields', 'forest', 'pine barrens', 'swamp', 'hills', 'mountains'];
  // Hours to cross one square on foot.
  LF.T_COST = [99, 99, 99, 1, 2.5, 1, 1, 1.5, 1.25, 3, 2, 4];
  LF.T_SIGHT = [0, 0, 0, 5, 4.5, 4.5, 4.5, 2.5, 3.5, 2.5, 6.5, 9];
  LF.isWater = (t) => t === T.DEEP || t === T.SEA || t === T.LAKE;
  LF.isLand = (t) => t >= T.BEACH;
  LF.isWoods = (t) => t === T.FOREST || t === T.PINE;
  LF.isWet = (t) => t === T.SWAMP || t === T.SALTMARSH;
  LF.isOpen = (t) => t === T.MEADOW || t === T.OLDFIELD;
  LF.isHigh = (t) => t === T.HILLS || t === T.MOUNTAIN;

  // Things worth finding. Seen only up close.
  const F = (LF.F = {
    NONE: 0,
    SPRING: 1,
    CLAY: 2,
    STONE: 3,
    SALTLICK: 4,
    BEAVER: 5,
    FALLS: 6,
    FORD: 7,
    CLIFF: 8,
    BURIAL: 9,
    BERRIES: 10,
    IRON: 11,
    WRECK: 12,
    RUIN: 13,
  });
  LF.F_INFO = {
    [F.SPRING]: { name: 'Spring', phrase: 'a spring', note: 'Clean water that does not depend on a river.' },
    [F.CLAY]: { name: 'Clay bank', phrase: 'a clay bank', note: 'Clay for bricks and chimneys.' },
    [F.STONE]: { name: 'Stone outcrop', phrase: 'building stone', note: 'Building stone for foundations and a mill.' },
    [F.SALTLICK]: { name: 'Salt lick', phrase: 'a salt lick', note: 'Deer come here from miles around.' },
    [F.BEAVER]: { name: 'Beaver ponds', phrase: 'beaver ponds', note: 'Pelts, which the Company prizes above all.' },
    [F.FALLS]: { name: 'Falls', phrase: 'falls for a mill', note: 'Water power for a mill. Canoes must carry around it.' },
    [F.FORD]: { name: 'Ford', phrase: 'a ford', note: 'A safe place to cross the river.' },
    [F.CLIFF]: { name: 'Bluff', phrase: 'a bluff over the water', note: 'High ground over the water. Easy to defend.' },
    [F.BURIAL]: { name: 'Burial ground', phrase: 'a burial ground', note: 'Sacred to the people who live here.' },
    [F.BERRIES]: { name: 'Berry thickets', phrase: 'berry thickets', note: 'Food in summer.' },
    [F.IRON]: { name: 'Bog iron', phrase: 'bog iron', note: 'Iron ore in the swamp. A smith could use it.' },
    [F.WRECK]: { name: 'Old wreck', phrase: 'an old wreck', note: 'The ribs of a ship. Some of her stores may be salvageable.' },
    [F.RUIN]: { name: 'Empty town', phrase: 'an empty town with its fields already cleared', note: 'A deserted town. Its fields are already cleared.' },
  };

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

  LF.valueNoise = function (seed) {
    return function (x, y) {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed);
      const c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
  };
  LF.fbm = function (n, x, y, oct) {
    let s = 0, amp = 1, f = 1, tot = 0;
    for (let i = 0; i < oct; i++) {
      s += n(x * f, y * f) * amp;
      tot += amp;
      amp *= 0.5;
      f *= 2;
    }
    return s / tot;
  };

  LF.idx = (x, y) => y * W + x;
  LF.inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  LF.N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  LF.N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Visit every square within radius r of (cx, cy).
  LF.around = function (cx, cy, r, fn) {
    const R = Math.ceil(r);
    for (let y = cy - R; y <= cy + R; y++)
      for (let x = cx - R; x <= cx + R; x++) {
        if (!LF.inb(x, y)) continue;
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r + 0.01) fn(x, y, d, LF.idx(x, y));
      }
  };

  // Text helpers.
  LF.esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  LF.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  LF.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  LF.num = (n) => (n >= 0 && n < NUM.length && n === Math.floor(n) ? NUM[n] : String(n));
  LF.Num = (n) => LF.cap(LF.num(n));
  LF.plural = (n, word, pl) => `${LF.num(n)} ${n === 1 ? word : pl || word + 's'}`;
  LF.listJoin = function (a) {
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  };
  LF.first = (m) => m.name.split(' ')[0];
  LF.last = (m) => m.name.split(' ').slice(-1)[0];
  LF.bearing = function (dx, dy) {
    const dirs = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    return dirs[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  };
  LF.miles = function (tiles) {
    const m = Math.round(tiles * LF.MILES_PER_TILE * 2) / 2;
    if (m === 0) return 'here';
    if (m === 0.5) return 'half a mile';
    return `${m % 1 ? m : m} mile${m === 1 ? '' : 's'}`;
  };
  LF.pick = (arr, r) => arr[Math.floor((r ? r() : Math.random()) * arr.length)];
  LF.shuffle = function (arr, r) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor((r ? r() : Math.random()) * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // Calendar. Day 1 is the 1st of May.
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  LF.dateOf = function (day) {
    let m = 4, d = day;
    while (d > MDAYS[m]) {
      d -= MDAYS[m];
      m = (m + 1) % 12;
    }
    return { month: m, date: d, name: `${d} ${MONTHS[m]}`, monthName: MONTHS[m] };
  };
  LF.season = function (day) {
    const m = LF.dateOf(day).month;
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'autumn';
    return 'winter';
  };
})();
