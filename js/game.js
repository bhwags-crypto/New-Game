// Landfall: game state, knowledge, the landing camp, and the interface shell.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, esc, clamp } = LF;

  LF.DEADLINE = 40;
  LF.SETTLERS = 30;
  const $ = (LF.$ = (s) => document.querySelector(s));

  // ---------------------------------------------------------------- knowledge

  const BASE_ERR = [0.4, 0.22, 0.11, 0.05];
  const CONFUSE = {
    [T.MEADOW]: [[T.SWAMP, 0.35], [T.FOREST, 0.35], [T.OLDFIELD, 0.15], [T.PINE, 0.15]],
    [T.OLDFIELD]: [[T.MEADOW, 0.7], [T.SWAMP, 0.3]],
    [T.SWAMP]: [[T.MEADOW, 0.55], [T.FOREST, 0.3], [T.OLDFIELD, 0.15]],
    [T.SALTMARSH]: [[T.MEADOW, 0.5], [T.BEACH, 0.3], [T.SEA, 0.2]],
    [T.FOREST]: [[T.MEADOW, 0.35], [T.PINE, 0.3], [T.HILLS, 0.2], [T.SWAMP, 0.15]],
    [T.PINE]: [[T.FOREST, 0.6], [T.MEADOW, 0.4]],
    [T.HILLS]: [[T.FOREST, 0.6], [T.MOUNTAIN, 0.4]],
    [T.MOUNTAIN]: [[T.HILLS, 1]],
    [T.BEACH]: [[T.SEA, 0.4], [T.MEADOW, 0.3], [T.SALTMARSH, 0.3]],
    [T.SEA]: [[T.BEACH, 0.6], [T.SALTMARSH, 0.2], [T.DEEP, 0.2]],
    [T.DEEP]: [[T.SEA, 1]],
    [T.LAKE]: [[T.SWAMP, 0.7], [T.MEADOW, 0.3]],
  };
  function confuse(k, r) {
    let u = r();
    for (const [t, w] of CONFUSE[k]) if ((u -= w) <= 0) return t;
    return CONFUSE[k][0][0];
  }

  // Record what someone believes about one true square.
  // o: { skill, sight, dx, dy, day, rng, src, errMul, hunter, closeLook }
  LF.observe = function (K, tx, ty, dist, o) {
    const x = tx + o.dx, y = ty + o.dy;
    if (!inb(x, y)) return false;
    const j = idx(x, y), i = idx(tx, ty);
    const w = LF.G.world;
    const p = Math.min(0.8, BASE_ERR[o.skill] * (0.35 + (1.1 * dist) / Math.max(1, o.sight)) * (o.errMul || 1));
    const q = 1 - p;
    const close = dist <= (o.closeLook === undefined ? 2.3 : o.closeLook);
    if (close && w.feat[i] && (w.feat[i] !== F.BURIAL || o.src === 1 || dist <= 1.5)) K.feat[j] = w.feat[i];
    if (K.t[j] >= 0 && K.q[j] >= q) {
      K.seen[j] = Math.max(K.seen[j], o.day);
      return false;
    }
    let k = w.t[i];
    if (o.rng() < p) k = confuse(k, o.rng);
    K.t[j] = k;
    K.q[j] = q;
    K.seen[j] = o.day;
    K.src[j] = o.src || 0;
    K.river[j] = w.river[i] && o.rng() > p * 0.7 ? 1 : 0;
    K.game[j] = o.hunter && w.game[i] && LF.isLand(k) ? 1 : 0;
    return true;
  };

  function effectiveQ(K, j) {
    return K.q[j] * Math.max(0.4, 1 - (LF.G.day - K.seen[j]) / 60);
  }

  LF.commitNotes = function (notes) {
    const G = LF.G;
    let added = 0, revised = 0;
    for (let j = 0; j < W * H; j++) {
      if (notes.feat[j]) G.K.feat[j] = notes.feat[j];
      if (notes.t[j] < 0) continue;
      if (G.K.t[j] < 0) added++;
      else if (notes.q[j] >= effectiveQ(G.K, j)) revised++;
      else {
        G.K.seen[j] = Math.max(G.K.seen[j], notes.seen[j]);
        continue;
      }
      G.K.t[j] = notes.t[j];
      G.K.q[j] = notes.q[j];
      G.K.seen[j] = notes.seen[j];
      G.K.river[j] = notes.river[j];
      G.K.game[j] = notes.game[j];
      G.K.src[j] = notes.src[j];
    }
    return { added, revised };
  };

  function seedKnowledge() {
    const G = LF.G, w = G.world;
    const R = LF.rng(G.seed * 3 + 7);
    // An older chart of this coast, copied from a copy, drawn a little off.
    const off = { dx: R() < 0.5 ? -1 : 1, dy: R() < 0.5 ? -3 : 3 };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const k = w.t[i];
        if (k === T.SEA || k === T.DEEP) {
          let nearLand = false;
          LF.around(x, y, 3, (ax, ay, d, j) => { if (LF.isLand(w.t[j])) nearLand = true; });
          if (!nearLand) {
            G.K.t[i] = T.SEA;
            G.K.q[i] = 0.5;
            G.K.src[i] = 2;
            continue;
          }
        }
        if ((w.seaDist[i] <= 2 || k === T.SEA || k === T.DEEP) && x > W * 0.35) {
          LF.observe(G.K, x, y, 6, { skill: 1, sight: 4, dx: off.dx, dy: off.dy, day: 1, rng: R, src: 2, errMul: 0.4, closeLook: -1 });
        }
      }
    // What the officers could make out from the deck on the way in.
    const s = w.ship;
    LF.around(s.x, s.y, 9, (x, y, d) => LF.observe(G.K, x, y, d, { skill: 2, sight: 9, dx: 0, dy: 0, day: 1, rng: R, closeLook: -1 }));
  }

  // ---------------------------------------------------------------- the officers' requests

  LF.MISSIONS = {
    voss: { text: 'Find beaver ponds or a salt lick. The Company wants proof there are furs here.', done: (G) => hasFeat(G, [F.BEAVER, F.SALTLICK]) },
    quarles: { text: 'Find a bluff over the water, or hills close to the coast.', done: (G) => hasFeat(G, [F.CLIFF]) || highCoast(G) },
    kemp: { text: 'Find open farmland: old fields or a wide meadow, not more woods.', done: (G) => countT(G, T.OLDFIELD) >= 4 || meadowBlock(G) },
    pryce: { text: 'Make peace with at least one of the towns.', done: (G) => G.world.villages.some((v) => v.relation >= 1) },
    harrow: { text: 'Find a spring, or a river mouth where the boats can come in.', done: (G) => hasFeat(G, [F.SPRING]) || riverMouth(G) },
  };
  function hasFeat(G, fs) {
    for (let j = 0; j < W * H; j++) if (fs.includes(G.K.feat[j])) return true;
    return false;
  }
  function countT(G, t) {
    let n = 0;
    for (let j = 0; j < W * H; j++) if (G.K.t[j] === t) n++;
    return n;
  }
  function meadowBlock(G) {
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        if (!LF.isOpen(G.K.t[idx(x, y)])) continue;
        let n = 0;
        LF.around(x, y, 2, (ax, ay, d, j) => { if (LF.isOpen(G.K.t[j])) n++; });
        if (n >= 11) return true;
      }
    return false;
  }
  function highCoast(G) {
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, y);
        if (G.K.t[i] !== T.HILLS || G.K.src[i] === 2) continue;
        let sea = false;
        LF.around(x, y, 1.5, (ax, ay, d, j) => { if (G.K.t[j] === T.SEA || G.K.t[j] === T.DEEP) sea = true; });
        if (sea) return true;
      }
    return false;
  }
  function riverMouth(G) {
    for (let j = 0; j < W * H; j++) {
      if (!G.K.river[j]) continue;
      let sea = false;
      LF.around(j % W, (j / W) | 0, 1, (ax, ay, d, k) => { if (G.K.t[k] === T.SEA) sea = true; });
      if (sea) return true;
    }
    return false;
  }

  LF.checkMissions = function () {
    const G = LF.G;
    const done = [];
    for (const [k, m] of Object.entries(LF.MISSIONS)) {
      const st = G.advisors[k];
      if (!st.missionDone && m.done(G)) {
        st.missionDone = true;
        st.loyalty = Math.min(100, st.loyalty + 15);
        done.push(k);
      }
    }
    return done;
  };

  // ---------------------------------------------------------------- setup

  LF.newGame = function (seed) {
    const world = LF.generateWorld(seed);
    const R = LF.rng(seed * 11 + 3);
    const crew = [...LF.CREW, ...LF.makeVolunteers(R)].map((c) => ({ ...c, traits: [...c.traits], health: 3, fatigue: 0, alive: true, away: false }));
    const G = (LF.G = {
      seed,
      world,
      day: 1,
      stores: { ...LF.START_STORES },
      hold: 5600,
      timber: 0,
      crew,
      K: LF.newKnowledge(),
      sites: [],
      party: null,
      mode: 'camp',
      journal: [],
      lateDays: 0,
      expeditions: 0,
      campOrder: 'forage',
      advisors: Object.fromEntries(Object.keys(LF.ADVISORS).map((k) => [k, { loyalty: 60, missionDone: false }])),
      showMap: false,
      flags: {},
      councilFocus: null,
    });
    seedKnowledge();
    G.sites.push({ letter: 'L', name: 'The Landing', x: world.camp.x, y: world.camp.y, tx: world.camp.x, ty: world.camp.y, day: 1, by: 'the ship’s officers', isLanding: true });
    LF.journal('The Constant anchored off an unknown shore. Master Blount will wait forty days, until the 9th of June, before he must sail for home. The settlers stay aboard until the council picks a site.');
    LF.resetCams();
    LF.closeModal(true);
    LF.render();
  };

  LF.journal = function (text) {
    LF.G.journal.push({ day: LF.G.day, text });
  };
  LF.crewById = (id) => LF.G.crew.find((c) => c.id === id);
  LF.hasTrait = (m, t) => !!(m.traits && m.traits.includes(t));
  LF.settlersAboard = () => LF.SETTLERS + Object.keys(LF.ADVISORS).length;

  // One day passes for the people at the landing and aboard ship.
  LF.campDay = function () {
    const G = LF.G;
    G.day++;
    const atCamp = G.crew.filter((c) => c.alive && !c.away);
    const eat = atCamp.reduce((s, c) => s + (LF.hasTrait(c, 'glutton') ? 1.5 : 1), 0);
    let food = 0;
    for (const c of atCamp) {
      if (G.campOrder === 'forage') food += 0.5 + c.forage * 0.6;
      else if (G.campOrder === 'fish') food += 0.9 + (LF.hasTrait(c, 'waterman') ? 0.8 : 0);
      else if (G.campOrder === 'timber') { G.timber += 1 + (LF.hasTrait(c, 'builder') ? 0.5 : 0); food += 0.2; }
      if (c.health < 3 && c.health > 0 && Math.random() < (G.campOrder === 'rest' ? 0.6 : 0.2)) c.health++;
      c.fatigue = Math.max(0, c.fatigue - 50);
    }
    G.stores.rations = Math.max(0, Math.round((G.stores.rations - eat + food) * 10) / 10);
    G.hold = Math.max(0, G.hold - LF.settlersAboard());
    if (G.day > LF.DEADLINE) G.lateDays++;
    LF.campEvents();
  };

  // Things that happen at the landing while the crew waits.
  LF.campEvents = function () {
    const G = LF.G;
    if (G.day >= 12 && !G.flags.visitors) {
      const friend = G.world.villages.find((v) => v.relation >= 1);
      if (friend) {
        G.flags.visitors = true;
        G.stores.rations += 20;
        friend.relation = Math.min(3, friend.relation + 0.5);
        LF.journal(`Canoes from ${friend.name} came to the landing with corn and smoked fish to trade.`);
        LF.queueModal({ title: 'Visitors at the landing', body: `<p>Three canoes from ${esc(friend.name)} put in at the beach. They have brought corn and smoked fish, and they want to see the ship. Harrow trades a few hatchets for the lot. <span class="muted">+20 rations at the landing.</span></p>` });
      }
    }
    if (G.day >= 25 && !G.flags.restless) {
      G.flags.restless = true;
      LF.queueModal({
        title: 'Trouble aboard',
        eyebrow: 'Ruth Kemp speaks for the settlers',
        body: '<p>Ruth Kemp has rowed ashore with a petition. The settlers have been cooped up for fourteen weeks. Two children have the bloody flux and the water casks are going green. They want a decision.</p>',
        locked: true,
        buttons: [
          { label: 'Promise a decision within ten days', primary: true, act: () => { G.flags.promiseDecision = G.day + 10; LF.journal('Promised the settlers a decision within ten days.'); } },
          { label: 'Let some families camp at the landing', act: () => { G.hold -= 60; G.advisors.kemp.loyalty += 8; G.advisors.harrow.loyalty -= 5; LF.journal('Let some settler families ashore to camp at the landing. Harrow grumbled about the stores.'); } },
          { label: 'Tell them to be patient', act: () => { G.advisors.kemp.loyalty -= 12; LF.journal('Told the settlers to be patient. Kemp was not pleased.'); } },
        ],
      });
    }
    if (G.flags.promiseDecision && G.day > G.flags.promiseDecision && !G.flags.promiseLapsed) {
      G.flags.promiseLapsed = true;
      G.advisors.kemp.loyalty -= 15;
      LF.journal('Ten days passed with no decision. The settlers feel lied to.');
    }
  };

  // ---------------------------------------------------------------- modal & toast

  const queue = [];
  LF.modalOpen = () => !$('#modal').hidden;
  LF.showModal = function (opts) {
    const { title, body, buttons, wide, locked, kind } = opts;
    const m = $('#modal');
    const box = m.querySelector('.modal');
    box.classList.toggle('wide', !!wide);
    box.dataset.kind = kind || '';
    m.dataset.locked = locked ? '1' : '';
    $('#modal-body').innerHTML = `${opts.eyebrow ? `<p class="m-eyebrow">${esc(opts.eyebrow)}</p>` : ''}<h2>${esc(title)}</h2><div class="mb">${body}</div><div class="mbtns"></div>`;
    const bar = $('#modal-body .mbtns');
    for (const b of buttons || [{ label: 'Close', primary: true }]) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.innerHTML = b.html || esc(b.label);
      if (b.id) el.id = b.id;
      if (b.disabled) el.disabled = true;
      if (b.title) el.title = b.title;
      el.onclick = () => {
        if (!b.keep) LF.closeModal();
        if (b.act) b.act();
        LF.render();
      };
      bar.appendChild(el);
    }
    m.hidden = false;
    box.scrollTop = 0;
    const f = bar.querySelector('.primary') || bar.querySelector('button');
    if (f) f.focus({ preventScroll: true });
    if (opts.onShow) opts.onShow();
  };
  LF.queueModal = function (opts) {
    if (LF.modalOpen()) queue.push(opts);
    else LF.showModal(opts);
  };
  LF.closeModal = function (clearQueue) {
    if (clearQueue) queue.length = 0;
    $('#modal').hidden = true;
    if (queue.length) LF.showModal(queue.shift());
  };

  let toastTimer = null;
  LF.toast = function (msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2800);
  };
  LF.tip = function (text) {
    const tip = $('#tip');
    if (!text) { tip.hidden = true; return; }
    tip.textContent = text;
    tip.hidden = false;
  };

  // ---------------------------------------------------------------- canvas & cameras

  const cv = (LF.canvas = () => $('#cv'));
  let chartCam = null;
  LF.resetCams = () => { chartCam = null; LF.localCam = null; };

  function fitChart() {
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    const cw = c.width / dpr, ch = c.height / dpr;
    const s = Math.min((cw - 16) / W, (ch - 16) / H);
    chartCam = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr };
  }
  LF.getChartCam = () => { if (!chartCam) fitChart(); return chartCam; };
  LF.focusChart = function (x, y, s) {
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    if (!chartCam) fitChart();
    chartCam.s = s;
    chartCam.ox = c.width / dpr / 2 - (x + 0.5) * s;
    chartCam.oy = c.height / dpr / 2 - (y + 0.5) * s;
  };

  function sizeCanvas() {
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    const r = $('#stage').getBoundingClientRect();
    const w = Math.max(200, Math.floor(r.width)), h = Math.max(200, Math.floor(r.height));
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      LF.resetCams();
    }
  }

  LF.stageDrawers = {};
  LF.chartExtras = {};
  LF.panels = {};
  LF.usesChart = {};
  LF.zoomers = {};
  LF.panners = {};
  LF.ledgers = {};
  LF.afterRender = {};
  LF.pointer = {};
  LF.keys = {};
  LF.animating = {};

  LF.chartOpts = function () {
    const G = LF.G;
    return { K: G.K, day: G.day, villages: G.world.villages, sites: G.sites, camp: G.world.camp, title: `A Chart of the Coast, ${LF.dateOf(G.day).name}` };
  };

  LF.chartCamActive = () => {
    const f = LF.usesChart[LF.G.mode];
    return f ? f() : true;
  };

  LF.drawStage = function () {
    const G = LF.G;
    if (!G) return;
    sizeCanvas();
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    const custom = LF.stageDrawers[G.mode];
    if (custom && custom(c, dpr)) return;
    if (!chartCam) fitChart();
    chartCam.dpr = dpr;
    LF.drawChart(c, { ...LF.chartOpts(), cam: chartCam, ...(LF.chartExtras[G.mode] ? LF.chartExtras[G.mode]() : {}) });
  };

  function zoomAt(mx, my, f) {
    const G = LF.G;
    if (LF.zoomers[G.mode]) return LF.zoomers[G.mode](mx, my, f);
    if (!chartCam) fitChart();
    const ns = clamp(chartCam.s * f, 4, 64);
    const k = ns / chartCam.s;
    chartCam.ox = mx - (mx - chartCam.ox) * k;
    chartCam.oy = my - (my - chartCam.oy) * k;
    chartCam.s = ns;
    LF.drawStage();
  }

  // ---------------------------------------------------------------- header & render

  function ledger() {
    const G = LF.G;
    if (LF.ledgers[G.mode]) return LF.ledgers[G.mode]();
    const atCamp = G.crew.filter((c) => c.alive && !c.away).length;
    const alive = G.crew.filter((c) => c.alive).length;
    const left = LF.DEADLINE - G.day;
    const dayClass = left < 0 ? 'bad' : left <= 7 ? 'warn' : '';
    return `
      <div class="chip ${dayClass}"><span class="k">${esc(LF.dateOf(G.day).name)}</span><span class="v">${left >= 0 ? `${left}<small> days left</small>` : `${-left}<small> days late</small>`}</span></div>
      <div class="chip ${G.stores.rations < 60 ? 'warn' : ''}"><span class="k">Camp stores</span><span class="v">${Math.floor(G.stores.rations)}<small> rations</small></span></div>
      <div class="chip"><span class="k">Ship’s hold</span><span class="v">${Math.floor(G.hold)}<small> rations</small></span></div>
      <div class="chip"><span class="k">At camp</span><span class="v">${atCamp}<small> / ${alive} crew</small></span></div>`;
  }

  LF.render = function () {
    const G = LF.G;
    if (!G) return;
    $('#ledger').innerHTML = ledger();
    const panel = $('#panel');
    const scroll = panel.dataset.mode === G.mode ? panel.scrollTop : 0;
    const p = LF.panels[G.mode];
    panel.innerHTML = p.html();
    panel.dataset.mode = G.mode;
    $('#app').dataset.mode = G.mode;
    if (p.wire) p.wire();
    panel.scrollTop = scroll;
    const chartShown = LF.chartCamActive();
    $('#zoom').hidden = !chartShown;
    $('#legend').hidden = !chartShown || !['camp', 'field', 'council', 'end'].includes(G.mode);
    $('#clock').hidden = true;
    LF.drawStage();
    if (LF.afterRender[G.mode]) LF.afterRender[G.mode]();
  };

  // ---------------------------------------------------------------- common UI bits

  LF.pips = function (n, max, cls) {
    let s = '';
    for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : ''} ${cls || ''}"></i>`;
    return `<span class="pips" aria-label="${n} of ${max}">${s}</span>`;
  };
  LF.traitTags = function (m) {
    return (m.traits || []).map((t) => `<span class="trait ${LF.TRAITS[t].good ? 'good' : 'bad'}" title="${esc(LF.TRAITS[t].desc)}">${esc(LF.TRAITS[t].name)}</span>`).join('');
  };
  LF.skillLine = function (m) {
    return LF.SKILLS.filter(([k]) => m[k] > 0).map(([k, l]) => `${l} ${m[k]}`).join(' · ');
  };
  LF.meter = (v, cls) => `<span class="meter ${cls || ''}"><span style="width:${clamp(v, 0, 100)}%"></span></span>`;

  function crewRow(m) {
    const status = !m.alive ? '<span class="tag bad">Dead</span>' : m.away ? '<span class="tag">In the field</span>' : m.health < 3 ? '<span class="tag warn">Hurt</span>' : '';
    return `<li class="${m.alive ? '' : 'dead'}"><div><strong>${esc(m.name)}</strong> <span class="role">${esc(m.role)}</span> ${status}</div><div class="sub">${LF.skillLine(m)}</div><div class="traits">${LF.traitTags(m)}</div></li>`;
  }

  function advisorCard(key) {
    const G = LF.G;
    const a = LF.ADVISORS[key], st = G.advisors[key];
    return `<li class="adv"><span class="medal">${a.initials}</span><div class="grow"><div><strong>${esc(a.name)}</strong> <span class="role">${esc(a.role)}</span></div>
      <div class="sub">${st.missionDone ? '<span class="ok">Done.</span> ' : ''}${esc(LF.MISSIONS[key].text)}</div>
      <div class="loyal"><span class="k">Loyalty</span>${LF.meter(st.loyalty)}</div></div></li>`;
  }

  const CAMP_ORDERS = {
    forage: ['Forage and hunt', 'Food for the camp.'],
    fish: ['Fish the shallows', 'Steady food. A waterman is best at it.'],
    timber: ['Cut timber', 'Logs stacked for building the colony. Little food.'],
    rest: ['Rest and mend', 'The hurt recover faster.'],
  };

  LF.panels.camp = {
    html() {
      const G = LF.G;
      const late = G.day > LF.DEADLINE;
      const anyone = G.crew.some((c) => c.alive);
      const sites = G.sites.map((s) => `<li><span class="seal">${s.letter}</span><div><strong>${esc(s.name)}</strong><div class="sub">Staked by ${esc(s.by)}, ${esc(LF.dateOf(s.day).name)}</div></div></li>`).join('');
      const journal = G.journal.slice(-8).reverse().map((j) => `<li><span class="d">${esc(LF.dateOf(j.day).name)}</span> ${esc(j.text)}</li>`).join('');
      const orders = Object.entries(CAMP_ORDERS).map(([k, [l, d]]) => `<label class="radio"><input type="radio" name="order" value="${k}" id="order-${k}" ${G.campOrder === k ? 'checked' : ''}><span><strong>${l}</strong><em>${d}</em></span></label>`).join('');
      const stores = LF.GEAR_ORDER.map((k) => `<dt>${LF.GEAR[k].name}</dt><dd>${Math.floor(G.stores[k])}</dd>`).join('');
      return `
        <h2>The map table</h2>
        <p class="lede">${late
          ? 'The deadline has passed. The settlers cannot stay aboard any longer. Convene the council and choose.'
          : `Master Blount sails in <strong>${LF.plural(LF.DEADLINE - G.day, 'day')}</strong>. Send parties inland, stake out sites, then call the council to choose where ${LF.settlersAboard() + G.crew.filter((c) => c.alive).length} people will spend the winter. Every day the settlers wait aboard costs food and planting time.`}</p>
        <div class="actions">
          <button class="btn primary" id="b-outfit" ${late || !anyone ? 'disabled' : ''}>Outfit an expedition</button>
          <button class="btn" id="b-council">Convene the council</button>
          <button class="btn" id="b-wait" ${late ? 'disabled' : ''}>Wait a day</button>
        </div>
        <h3>The officers’ requests</h3>
        <ul class="advs">${Object.keys(LF.ADVISORS).map(advisorCard).join('')}</ul>
        <h3>Candidate sites</h3>
        <ul class="sites">${sites}</ul>
        <h3>Work at the landing</h3>
        <div class="radios">${orders}</div>
        <p class="hint">${G.timber ? `${Math.floor(G.timber)} loads of timber stacked for the colony.` : 'Anyone left at the landing does this each day.'}</p>
        <h3>Stores at the landing</h3>
        <dl class="facts cols">${stores}</dl>
        <h3>Crew</h3>
        <ul class="crew">${G.crew.map(crewRow).join('')}</ul>
        <h3>Journal</h3>
        <ul class="journal">${journal}</ul>
        <button class="btn ghost small" id="b-new">Start over with a new coast</button>`;
    },
    wire() {
      const G = LF.G;
      const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
      on('b-outfit', () => LF.outfit());
      on('b-council', () => LF.openCouncil());
      on('b-wait', () => { LF.campDay(); LF.render(); });
      on('b-new', LF.confirmNew);
      document.querySelectorAll('input[name=order]').forEach((r) => (r.onchange = () => { G.campOrder = r.value; }));
    },
  };

  LF.confirmNew = function () {
    LF.showModal({
      title: 'Start over?',
      body: '<p>This abandons the current voyage and generates a new coast.</p>',
      buttons: [{ label: 'Start over', primary: true, act: () => LF.newGame((Math.random() * 1e9) | 0) }, { label: 'Keep playing' }],
    });
  };

  function intro() {
    LF.showModal({
      title: 'Landfall',
      eyebrow: 'The 1st of May. Off an unknown coast.',
      wide: true,
      body: `
        <p>The <em>Constant</em> rides at anchor off a coast no one aboard has walked. Below decks are thirty settlers who have been at sea for eleven weeks.</p>
        <p>Master Blount will wait forty days, then he must sail for home. Before then you must choose where the colony will spend its first winter. Choose well and it survives. Choose badly and you will bury people.</p>
        <p>You have a chart, but most of it is blank, and the parts that are drawn came from an older voyage. Your surveyors will fill it in. They will not always get it right.</p>
        <ol class="howto">
          <li><strong>Outfit expeditions.</strong> Pick the people, the gear and the pace. Everyone has strengths and flaws.</li>
          <li><strong>Walk the land.</strong> You see the true country only where the party stands. Dusk comes at six, and the choices made around the fire matter.</li>
          <li><strong>Plant survey stakes</strong> at places worth settling. Their notes reach the chart only if the party makes it back.</li>
          <li><strong>Hold the council.</strong> Five officers argue over the sites, using nothing but the chart.</li>
          <li><strong>Lay out the colony and live through the first year.</strong> The supply ship returns in May.</li>
        </ol>`,
      buttons: [{ label: 'Go to the map table', primary: true }],
    });
  }

  // ---------------------------------------------------------------- input

  function setupInput() {
    const c = cv();
    let drag = null;
    const handler = (name) => LF.pointer[LF.G.mode] && LF.pointer[LF.G.mode][name];
    c.addEventListener('pointerdown', (ev) => {
      const h = handler('down');
      if (h && h(ev)) return;
      if (!LF.chartCamActive()) return;
      const cam = LF.panners[LF.G.mode] ? LF.panners[LF.G.mode]() : LF.getChartCam();
      drag = { x: ev.clientX, y: ev.clientY, ox: cam.ox, oy: cam.oy, cam, moved: false };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      if (drag) {
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
        drag.cam.ox = drag.ox + dx;
        drag.cam.oy = drag.oy + dy;
        LF.drawStage();
        return;
      }
      const h = handler('move');
      if (h) h(ev);
    });
    c.addEventListener('pointerup', (ev) => {
      const wasDrag = drag && drag.moved;
      drag = null;
      const h = handler('up');
      if (h) h(ev, wasDrag);
    });
    c.addEventListener('pointerleave', () => {
      LF.tip(null);
      const h = handler('leave');
      if (h) h();
    });
    c.addEventListener('click', (ev) => {
      if (LF.modalOpen()) return;
      const h = handler('click');
      if (h) h(ev);
    });
    c.addEventListener('wheel', (ev) => {
      if (!LF.chartCamActive()) return;
      ev.preventDefault();
      const r = c.getBoundingClientRect();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    $('#z-in').onclick = () => { const r = c.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.3); };
    $('#z-out').onclick = () => { const r = c.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.3); };
    $('#z-fit').onclick = () => { LF.resetCams(); LF.drawStage(); };
    $('#legend-toggle').onclick = () => $('#legend').classList.toggle('open');

    window.addEventListener('keydown', (ev) => {
      if (LF.modalOpen()) {
        if (ev.key === 'Escape' && !$('#modal').dataset.locked) LF.closeModal();
        return;
      }
      const t = ev.target;
      if (t && /INPUT|TEXTAREA|SELECT/.test(t.tagName) && t.type !== 'radio' && t.type !== 'checkbox' && t.type !== 'range') return;
      if (LF.keys[LF.G.mode]) LF.keys[LF.G.mode](ev);
    });
    window.addEventListener('resize', () => { LF.resetCams(); LF.drawStage(); });
  }

  function tick() {
    const G = LF.G;
    if (G && LF.animating[G.mode] && LF.animating[G.mode]() && !document.hidden) LF.drawStage();
    setTimeout(() => requestAnimationFrame(tick), 100);
  }

  function buildLegend() {
    const ul = $('#legend-feats');
    for (const [f, info] of Object.entries(LF.F_INFO)) {
      const li = document.createElement('li');
      const c = document.createElement('canvas');
      c.width = 44;
      c.height = 44;
      c.setAttribute('aria-hidden', 'true');
      const g = c.getContext('2d');
      g.scale(2, 2);
      LF.featGlyph(g, +f, 11, 11, 22, '59,42,26', 1);
      li.appendChild(c);
      li.append(info.name);
      ul.appendChild(li);
    }
  }

  function boot() {
    buildLegend();
    setupInput();
    LF.newGame((Math.random() * 1e9) | 0);
    intro();
    tick();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => LF.drawStage());
  }
  LF.debug = () => LF.G;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
