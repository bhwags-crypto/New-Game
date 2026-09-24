// Landfall: game state, rules and interface.
(function () {
  const LF = window.LF;
  const { T, W, H, idx, inb } = LF;

  const DEADLINE = 40;
  const SETTLERS = 30;
  const DAYLIGHT = 12;
  const MAX_SITES = 4;

  const CREW = [
    { id: 'hale', name: 'Thomas Hale', role: 'Surveyor', survey: 3, forage: 0, guard: 0, tongue: 0, heal: 0, note: 'Trained under the Company chartmakers. Slow, and exact.' },
    { id: 'pell', name: 'Agnes Pell', role: 'Surveyor', survey: 2, forage: 1, guard: 0, tongue: 0, heal: 0, note: 'Keeps the ship’s log. A fast sketcher, sometimes too fast.' },
    { id: 'crane', name: 'Josiah Crane', role: 'Hunter', survey: 0, forage: 3, guard: 1, tongue: 0, heal: 0, note: 'Fed a garrison through a hard winter once, and mentions it often.' },
    { id: 'whitlock', name: 'Mary Whitlock', role: 'Hunter', survey: 1, forage: 2, guard: 0, tongue: 0, heal: 0, note: 'Grew up trapping in the fens. Reads ground well.' },
    { id: 'ashby', name: 'Samuel Ashby', role: 'Soldier', survey: 0, forage: 0, guard: 3, tongue: 0, heal: 0, note: 'Veteran of two sieges. Sleeps with his musket.' },
    { id: 'dunning', name: 'Robert Dunning', role: 'Soldier', survey: 0, forage: 1, guard: 2, tongue: 0, heal: 0, note: 'Young and steady. Can shoot for the pot in a pinch.' },
    { id: 'rowe', name: 'Elias Rowe', role: 'Translator', survey: 0, forage: 0, guard: 0, tongue: 3, heal: 0, note: 'Spent two years among the coastal peoples on an earlier voyage.' },
    { id: 'colby', name: 'Hannah Colby', role: 'Physician', survey: 0, forage: 0, guard: 0, tongue: 0, heal: 3, note: 'Carries Jesuit’s bark for fevers, and a saw for worse.' },
    { id: 'fenwick', name: 'John Fenwick', role: 'Carpenter', survey: 1, forage: 1, guard: 1, tongue: 0, heal: 0, note: 'Good with a compass and a chain. Better with an adze.' },
    { id: 'tapp', name: 'William Tapp', role: 'Laborer', survey: 0, forage: 1, guard: 1, tongue: 1, heal: 0, note: 'Picked up a few words of the coast trade tongue at the fishing grounds.' },
  ];
  const OFFICERS = {
    harrow: { name: 'Giles Harrow', role: 'Quartermaster' },
    pryce: { name: 'Rev. Nathaniel Pryce', role: 'Chaplain' },
    voss: { name: 'Edmund Voss', role: 'Company agent' },
  };
  const SKILLS = [['survey', 'Survey'], ['forage', 'Forage'], ['guard', 'Guard'], ['tongue', 'Tongue'], ['heal', 'Healing']];

  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const first = (m) => m.name.split(' ')[0];
  const last = (m) => m.name.split(' ').slice(-1)[0];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NUM = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const num = (n) => (n >= 0 && n < NUM.length ? NUM[n] : String(n));
  const Num = (n) => LF.cap(num(n));

  let G = null;

  // ---------------------------------------------------------------- knowledge

  const BASE_ERR = [0.42, 0.24, 0.12, 0.05];
  const CONFUSE = {
    [T.MEADOW]: [[T.SWAMP, 0.5], [T.FOREST, 0.5]],
    [T.SWAMP]: [[T.MEADOW, 0.65], [T.FOREST, 0.35]],
    [T.FOREST]: [[T.MEADOW, 0.5], [T.HILLS, 0.3], [T.SWAMP, 0.2]],
    [T.HILLS]: [[T.FOREST, 0.6], [T.MOUNTAIN, 0.4]],
    [T.MOUNTAIN]: [[T.HILLS, 1]],
    [T.BEACH]: [[T.SEA, 0.5], [T.MEADOW, 0.3], [T.SWAMP, 0.2]],
    [T.SEA]: [[T.BEACH, 0.7], [T.DEEP, 0.3]],
    [T.DEEP]: [[T.SEA, 1]],
  };
  function confuse(k, r) {
    let u = r();
    for (const [t, w] of CONFUSE[k]) if ((u -= w) <= 0) return t;
    return CONFUSE[k][0][0];
  }

  // Record what a party (or the deck, or an old chart) believes about one true tile.
  function observe(K, tx, ty, dist, o) {
    const x = tx + o.dx, y = ty + o.dy;
    if (!inb(x, y)) return;
    const j = idx(x, y), i = idx(tx, ty);
    const w = G.world;
    const p = Math.min(0.8, BASE_ERR[o.skill] * (0.35 + (1.1 * dist) / Math.max(1, o.sight)) * (o.errMul || 1));
    const q = 1 - p;
    if (K.t[j] >= 0 && K.q[j] >= q) {
      K.seen[j] = Math.max(K.seen[j], o.day);
      return;
    }
    let k = w.t[i];
    if (o.rng() < p) k = confuse(k, o.rng);
    K.t[j] = k;
    K.q[j] = q;
    K.seen[j] = o.day;
    K.src[j] = o.src || 0;
    K.river[j] = w.river[i] && o.rng() > p * 0.7 ? 1 : 0;
    K.game[j] = o.hunter && w.game[i] && !LF.isWater(k) ? 1 : 0;
  }

  function effectiveQ(K, j) {
    return K.q[j] * Math.max(0.4, 1 - (G.day - K.seen[j]) / 70);
  }

  function commitNotes(notes) {
    let added = 0, revised = 0;
    for (let j = 0; j < W * H; j++) {
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
  }

  function seedKnowledge() {
    const w = G.world;
    const R = LF.rng(G.seed * 3 + 7);
    // An older chart of this coast, copied from a copy, drawn a little off.
    const off = { dx: R() < 0.5 ? -1 : 1, dy: R() < 0.5 ? -2 : 2 };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = idx(x, y);
        const k = w.t[i];
        if (LF.isWater(k)) {
          let nearLand = false;
          for (let dy = -3; dy <= 3 && !nearLand; dy++)
            for (let dx = -3; dx <= 3; dx++) if (inb(x + dx, y + dy) && !LF.isWater(w.t[idx(x + dx, y + dy)])) { nearLand = true; break; }
          if (!nearLand) {
            G.K.t[i] = T.SEA;
            G.K.q[i] = 0.5;
            G.K.src[i] = 2;
            continue;
          }
        }
        if ((w.seaDist[i] <= 2 || LF.isWater(k)) && x > W * 0.35) observe(G.K, x, y, 6, { skill: 1, sight: 4, dx: off.dx, dy: off.dy, day: 1, rng: R, src: 2, errMul: 0.4 });
      }
    // What the officers could make out from the deck on the way in.
    const s = w.ship;
    for (let y = s.y - 8; y <= s.y + 8; y++)
      for (let x = s.x - 8; x <= s.x + 8; x++) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (!inb(x, y) || d > 7.5) continue;
        observe(G.K, x, y, d, { skill: 2, sight: 7, dx: 0, dy: 0, day: 1, rng: R });
      }
  }

  // ---------------------------------------------------------------- setup

  function newGame(seed) {
    const world = LF.generateWorld(seed);
    G = {
      seed,
      world,
      day: 1,
      stores: 300,
      tools: 10,
      crew: CREW.map((c) => ({ ...c, health: 3, alive: true, away: false })),
      K: LF.newKnowledge(),
      sites: [],
      party: null,
      mode: 'camp',
      journal: [],
      lateDays: 0,
      expeditions: 0,
      showMap: false,
      reveal: false,
      result: null,
      councilFocus: null,
    };
    seedKnowledge();
    G.sites.push({ letter: 'L', name: 'The Landing', x: world.camp.x, y: world.camp.y, tx: world.camp.x, ty: world.camp.y, day: 1, by: 'the ship’s officers', isLanding: true });
    G.journal.push({ day: 1, text: 'The Constant anchored off an unknown shore. Master Blount will wait forty days before he must sail for home. The settlers stay aboard until the council picks a site.' });
    chartCam = null;
    closeModal();
    render();
  }

  // ---------------------------------------------------------------- party helpers

  const aliveMembers = () => (G.party ? G.party.members.map((id) => G.crew.find((c) => c.id === id)).filter((m) => m.alive) : []);
  function skill(key) {
    return aliveMembers().reduce((b, m) => Math.max(b, m[key]), 0);
  }
  function bestAt(key) {
    return aliveMembers().reduce((b, m) => (!b || m[key] > b[key] ? m : b), null);
  }

  function campDay() {
    const atCamp = G.crew.filter((c) => c.alive && !c.away);
    const eat = atCamp.length + 3;
    const forage = atCamp.reduce((s, c) => s + 0.35 + c.forage * 0.6, 0);
    G.stores = Math.max(0, Math.round((G.stores - eat + forage) * 10) / 10);
  }

  // ---------------------------------------------------------------- expedition

  function launch(ids, days, gifts) {
    const rations = days * ids.length;
    G.stores = Math.round((G.stores - rations) * 10) / 10;
    G.tools -= gifts;
    G.expeditions++;
    for (const id of ids) G.crew.find((c) => c.id === id).away = true;
    G.party = {
      members: ids,
      rations,
      gifts,
      x: G.world.camp.x,
      y: G.world.camp.y,
      hours: 0,
      nights: 0,
      drift: { x: 0, y: 0 },
      notes: LF.newKnowledge(),
      stakes: [],
      seen: new Set(),
      visited: new Set(),
      avoided: new Set(),
      startDay: G.day,
      log: [],
      rng: LF.rng(G.seed * 31 + G.expeditions * 977),
    };
    G.party.alive = aliveMembers();
    G.mode = 'field';
    G.showMap = false;
    const names = G.party.alive.map(first);
    plog(`Set out from the landing: ${listJoin(names)}, with ${rations} rations${gifts ? ` and ${num(gifts)} bundles of trade tools` : ''}.`);
    closeModal();
    look();
    render();
  }

  function plog(text) {
    G.party.log.push({ day: G.day, text });
  }

  function listJoin(a) {
    if (a.length <= 1) return a.join('');
    return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
  }

  // Look around from where the party stands. Returns true if something demands attention.
  function look() {
    const p = G.party, w = G.world;
    const r = LF.sightRadius(w.t[idx(p.x, p.y)]);
    const o = { skill: skill('survey'), sight: r, dx: p.drift.x, dy: p.drift.y, day: G.day, rng: p.rng, hunter: skill('forage') >= 2 };
    const span = Math.ceil(r);
    for (let y = p.y - span; y <= p.y + span; y++)
      for (let x = p.x - span; x <= p.x + span; x++) {
        const d = Math.hypot(x - p.x, y - p.y);
        if (!inb(x, y) || d > r + 0.01) continue;
        observe(p.notes, x, y, d, o);
        p.seen.add(idx(x, y));
      }
    for (const v of w.villages) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d > r + 0.01) continue;
      v.pencil = { x: clamp(v.x + p.drift.x, 0, W - 1), y: clamp(v.y + p.drift.y, 0, H - 1) };
      if (!v.contacted && !p.avoided.has(v.id)) {
        stopWalk();
        contact(v);
        return true;
      }
      if (v.contacted && d <= 1.5 && !p.visited.has(v.id)) {
        p.visited.add(v.id);
        stopWalk();
        visit(v);
        return true;
      }
    }
    return false;
  }

  function stepCost(x, y, fromX, fromY) {
    const w = G.world, i = idx(x, y);
    return LF.T_COST[w.t[i]] + (w.river[i] && !w.river[idx(fromX, fromY)] ? 2 : 0);
  }

  function tryStep(dx, dy) {
    if (modalOpen() || !G.party) return false;
    const p = G.party, w = G.world;
    const nx = p.x + dx, ny = p.y + dy;
    if (!inb(nx, ny)) return false;
    if (LF.isWater(w.t[idx(nx, ny)])) {
      toast('Open water. The party cannot cross it.');
      return false;
    }
    p.hours += stepCost(nx, ny, p.x, p.y);
    p.x = nx;
    p.y = ny;
    if (nx === w.camp.x && ny === w.camp.y) {
      stopWalk();
      returnToCamp();
      return false;
    }
    const serious = [];
    while (p.hours >= DAYLIGHT && G.party) {
      p.hours -= DAYLIGHT;
      serious.push(...night());
    }
    if (!G.party) return false;
    p.alive = aliveMembers();
    if (serious.length) {
      stopWalk();
      render();
      showModal({ title: 'In the night', body: serious.map((s) => `<p>${s}</p>`).join(''), buttons: [{ label: 'Carry on', primary: true, act: () => { look(); render(); } }] });
      return false;
    }
    const stop = look();
    render();
    return !stop;
  }

  function night() {
    const p = G.party, w = G.world, R = p.rng;
    G.day++;
    p.nights++;
    campDay();
    const alive = aliveMembers();
    const here = w.t[idx(p.x, p.y)];
    const serious = [];
    const pick = () => alive[Math.floor(R() * alive.length)];

    if (p.rations >= alive.length) p.rations -= alive.length;
    else {
      p.rations = 0;
      for (const m of alive) m.health--;
      plog('The food is gone. Everyone slept hungry.');
    }

    const fs = skill('forage');
    const hunter = bestAt('forage');
    if (here !== T.SWAMP && here !== T.MOUNTAIN) {
      const gameHere = w.game[idx(p.x, p.y)];
      const chance = 0.12 + 0.2 * fs + (here === T.FOREST ? 0.1 : 0) + (gameHere ? 0.15 : 0);
      if (R() < chance) {
        const got = 1 + Math.round(R() * fs * 2) + (gameHere ? 2 : 0);
        p.rations += got;
        plog(`${first(hunter)} brought in game. +${got} rations.`);
      }
    }

    let marsh = 0;
    for (const [dx, dy] of [[0, 0], ...LF.N8]) if (inb(p.x + dx, p.y + dy) && w.t[idx(p.x + dx, p.y + dy)] === T.SWAMP) marsh++;
    if (marsh >= 2 && R() < 0.45) {
      const v = pick();
      if (skill('heal') >= 2) plog(`${first(v)} took a fever from the marsh air. Colby’s bark tea brought it down.`);
      else {
        v.health--;
        plog(`${first(v)} woke shaking with marsh fever.`);
      }
    }
    if ((here === T.FOREST || here === T.HILLS) && R() < 0.1) {
      if (skill('guard') >= 2) plog(`Something large circled the fire after dark. ${first(bestAt('guard'))} fired once and it left.`);
      else {
        const v = pick();
        v.health--;
        plog(`A bear came into camp. ${first(v)} was mauled before it ran off.`);
      }
    }
    if (R() < 0.07) {
      p.hours += 4;
      p.rations = Math.max(0, p.rations - 2);
      plog('A storm soaked the packs. Two rations spoiled and the morning was lost.');
    }
    if ((here === T.MEADOW || here === T.BEACH) && R() < 0.08) {
      p.rations += 3;
      plog('Found a thicket of ripe berries. +3 rations.');
    }

    const sk = skill('survey');
    if (R() < [0.55, 0.22, 0.06, 0][sk]) {
      const d = LF.N4[Math.floor(R() * 4)];
      p.drift.x = clamp(p.drift.x + d[0], -2, 2);
      p.drift.y = clamp(p.drift.y + d[1], -2, 2);
      if (sk === 0) plog('Nobody can say for sure how far we walked today.');
    }

    if (skill('heal') >= 2) for (const m of alive) if (m.health > 0 && m.health < 3 && R() < 0.35) m.health++;

    for (const m of alive)
      if (m.health <= 0) {
        m.alive = false;
        m.diedDay = G.day;
        m.away = false;
        plog(`${m.name} died.`);
        serious.push(`<strong>${esc(m.name)}</strong>, ${m.role.toLowerCase()}, died in the night on day ${G.day}.`);
        G.journal.push({ day: G.day, text: `${m.name} died in the field.` });
      }

    if (G.day > DEADLINE) {
      G.lateDays++;
      if (G.lateDays === 1) serious.push('Day 40 has passed. The settlers are restless aboard ship and the first cases of scurvy have appeared. Every day now costs lives.');
    }

    if (!aliveMembers().length) {
      partyLost();
      return [];
    }
    return serious;
  }

  function makeCamp() {
    if (!G.party || modalOpen()) return;
    const p = G.party;
    p.hours = 0;
    const serious = night();
    if (!G.party) return;
    // A night of rest heals a little even without a physician.
    for (const m of aliveMembers()) if (m.health > 0 && m.health < 3 && p.rng() < 0.3) m.health++;
    p.alive = aliveMembers();
    render();
    if (serious.length) showModal({ title: 'In the night', body: serious.map((s) => `<p>${s}</p>`).join(''), buttons: [{ label: 'Carry on', primary: true }] });
  }

  function partyLost() {
    const p = G.party;
    const names = p.members.map((id) => G.crew.find((c) => c.id === id).name);
    for (const v of G.world.villages) v.pencil = null;
    G.journal.push({ day: G.day, text: `The party of ${listJoin(names)} never came back. Their notes and survey stakes are lost with them.` });
    G.party = null;
    G.mode = 'camp';
    stopWalk();
    render();
    showModal({
      title: 'The party is lost',
      body: `<p>No one from the party of ${esc(listJoin(names))} made it back to the landing. Whatever they drew in their notebooks is gone, along with any stakes they planted.</p>`,
      buttons: [{ label: 'Return to the map table', primary: true }],
    });
  }

  function returnToCamp() {
    const p = G.party;
    const alive = aliveMembers();
    const dead = p.members.map((id) => G.crew.find((c) => c.id === id)).filter((m) => !m.alive);
    const { added, revised } = commitNotes(p.notes);
    for (const st of p.stakes) G.sites.push({ ...st });
    for (const v of G.world.villages)
      if (v.pencil) {
        v.drawn = v.pencil;
        v.pencil = null;
      }
    G.stores = Math.round((G.stores + p.rations) * 10) / 10;
    G.tools += p.gifts;
    for (const m of alive) m.away = false;
    const days = G.day - p.startDay;
    const text = `The party returned after ${days} day${days === 1 ? '' : 's'}. ${Num(added)} square miles added to the chart${revised ? `, ${num(revised)} redrawn` : ''}.${p.stakes.length ? ` Stakes planted: ${p.stakes.map((s) => s.name).join(', ')}.` : ''}${dead.length ? ` Lost: ${listJoin(dead.map((d) => d.name))}.` : ''}`;
    G.journal.push({ day: G.day, text });
    const drifted = p.drift.x || p.drift.y;
    G.party = null;
    G.mode = 'camp';
    render();
    showModal({
      title: 'Back at the landing',
      body: `<p>${esc(text)}</p><p class="muted">${
        drifted
          ? 'The field notes have been inked onto the chart. The surveyor looked uneasy about the distances.'
          : 'The field notes have been inked onto the chart.'
      }${p.rations ? ` ${Math.floor(p.rations)} unused rations went back into stores.` : ''}</p>`,
      buttons: [{ label: 'To the map table', primary: true }],
    });
  }

  // ---------------------------------------------------------------- stakes

  function nameFor(x, y) {
    const w = G.world, i = idx(x, y);
    const who = bestAt('survey');
    const S = last(who && who.survey > 0 ? who : aliveMembers()[0]);
    let nearRiver = false;
    for (const [dx, dy] of [[0, 0], ...LF.N8]) if (inb(x + dx, y + dy) && w.river[idx(x + dx, y + dy)]) nearRiver = true;
    const k = w.t[i];
    let name;
    if (nearRiver && w.seaDist[i] <= 2) name = `${S}’s River Mouth`;
    else if (w.seaDist[i] <= 1) name = `${S}’s Point`;
    else if (k === T.HILLS || k === T.MOUNTAIN) name = `${S}’s Rise`;
    else if (nearRiver) name = `${S}’s Ford`;
    else if (k === T.SWAMP) name = `${S}’s Bottoms`;
    else if (k === T.FOREST) name = `${S}’s Wood`;
    else name = `${S}’s Meadow`;
    const taken = new Set([...G.sites, ...G.party.stakes].map((s) => s.name));
    if (taken.has(name)) {
      let n = 2;
      while (taken.has(`${name} ${n}`)) n++;
      name = `${name} ${n}`;
    }
    return name;
  }

  function plantStake() {
    const p = G.party;
    if (!p || modalOpen()) return;
    const count = G.sites.filter((s) => !s.isLanding).length + p.stakes.length;
    if (count >= MAX_SITES) return toast('The council will only weigh four sites. Plant no more.');
    if (p.stakes.some((s) => s.tx === p.x && s.ty === p.y)) return toast('There is already a stake here.');
    if (Math.hypot(p.x - G.world.camp.x, p.y - G.world.camp.y) < 3) return toast('Too close to the landing to count as a separate site.');
    const used = new Set([...G.sites, ...p.stakes].map((s) => s.letter));
    const letter = 'ABCDEFG'.split('').find((l) => !used.has(l));
    const who = bestAt('survey');
    const st = { letter, name: nameFor(p.x, p.y), x: clamp(p.x + p.drift.x, 0, W - 1), y: clamp(p.y + p.drift.y, 0, H - 1), tx: p.x, ty: p.y, day: G.day, by: who && who.survey > 0 ? who.name : aliveMembers()[0].name, byId: who && who.survey > 0 ? who.id : null };
    p.stakes.push(st);
    plog(`Planted a survey stake: ${st.name} (Site ${letter}). It counts once the party is back at the landing.`);
    render();
  }

  // ---------------------------------------------------------------- native towns

  function contact(v) {
    const p = G.party;
    const tongue = skill('tongue'), guard = skill('guard');
    const translator = bestAt('tongue');
    const riverSide = G.world.river[idx(v.x, v.y)] || LF.N8.some(([dx, dy]) => inb(v.x + dx, v.y + dy) && G.world.river[idx(v.x + dx, v.y + dy)]);
    const speak =
      tongue >= 2
        ? `${esc(translator.name)} recognizes their speech as a cousin of the coast languages and thinks he can be understood.`
        : tongue === 1
        ? `${esc(first(translator))} knows a handful of trade words. It will not go far.`
        : 'Nobody in the party speaks a word of their language.';
    const buttons = [{ label: 'Walk in openly, hands empty', primary: true, act: () => resolveContact(v, 'open') }];
    if (p.gifts > 0) buttons.push({ label: `Lead with gifts: ${p.gifts >= 2 ? 'two bundles' : 'one bundle'} of iron tools`, act: () => resolveContact(v, 'gifts') });
    if (guard > 0) buttons.push({ label: 'Approach under arms', act: () => resolveContact(v, 'arms') });
    buttons.push({ label: 'Keep your distance and move on', act: () => resolveContact(v, 'avoid') });
    showModal({
      title: 'Smoke above the trees',
      body: `<p>Past the next rise the party finds fields of corn, beans and squash, and beyond them a town of bark-covered houses ${riverSide ? 'on the riverbank' : 'in a wide clearing'}. Children have already seen you and run back toward the houses. Men are coming out to look.</p><p>${speak}</p>`,
      buttons,
      locked: true,
    });
  }

  function resolveContact(v, how) {
    const p = G.party;
    const tongue = skill('tongue');
    const translator = bestAt('tongue');
    let body = '';
    if (how === 'avoid') {
      p.avoided.add(v.id);
      plog('Saw a town and kept away from it. They certainly saw us.');
      closeModal();
      render();
      return;
    }
    v.contacted = true;
    if (how === 'open') {
      v.relation = tongue >= 2 ? 1 : 0;
      body = tongue >= 2
        ? `<p>${esc(first(translator))} does the talking. It is slow going, but by evening the party is sitting at a fire inside the town, eating roasted corn. They call themselves <strong>${esc(v.name)}</strong>, in ${esc(first(translator))}’s rendering.</p>`
        : `<p>The meeting is all gestures. Both sides are polite and neither understands much. The party is given water and watched until it leaves. You learn only that this is the town of <strong>${esc(v.name)}</strong>, or something like it.</p>`;
    } else if (how === 'gifts') {
      const n = Math.min(2, p.gifts);
      p.gifts -= n;
      v.relation = tongue >= 2 ? 2 : 1;
      body = `<p>The iron hatchets and knives are passed around and tested on firewood. ${
        tongue >= 2 ? `${esc(first(translator))} explains where you have come from, as best he can.` : 'Nobody can explain much, but the gift says enough.'
      } These are <strong>${esc(v.name)}</strong>.</p>`;
    } else if (how === 'arms') {
      v.relation = -2;
      body = `<p>The party comes in with muskets shouldered and matches lit. Nobody comes out to meet it. After a long wait an older man sets a basket of corn on the path and walks back without a word. You will learn later that this meeting was talked about for years.</p>`;
    }
    plog(`Met ${v.name}. ${v.relation >= 1 ? 'A good meeting.' : v.relation === 0 ? 'A cautious meeting.' : 'A bad meeting.'}`);

    if (v.relation >= 1) {
      p.rations += 4;
      body += '<p>They send the party off with a sack of parched corn. <span class="muted">+4 rations.</span></p>';
    }
    if (v.relation >= 1 && tongue >= 2) {
      tellOfLand(v);
      v.territoryKnown = true;
      body += `<p>The elders draw the country for ${esc(first(translator))} in the dirt with a stick: rivers, marshes, the high ground. He copies it into the notebook. Then they mark out their hunting grounds, a day’s walk in every direction from the town, and ask that your people not build inside them.</p>`;
      showModal({
        title: LF.cap(v.name),
        body,
        locked: true,
        buttons: [
          { label: 'Give your word', primary: true, act: () => { v.promised = true; v.relation += 1; plog(`Promised ${v.name} not to settle in their hunting grounds.`); closeModal(); render(); } },
          { label: 'Promise nothing', act: () => { plog(`Made ${v.name} no promise about their hunting grounds.`); closeModal(); render(); } },
        ],
      });
      return;
    }
    showModal({ title: LF.cap(v.name), body, buttons: [{ label: 'Move on', primary: true }] });
    render();
  }

  function tellOfLand(v) {
    const p = G.party;
    const o = { skill: 3, sight: 8, dx: p.drift.x, dy: p.drift.y, day: G.day, rng: p.rng, src: 1, errMul: 0.8, hunter: true };
    for (let y = v.y - 8; y <= v.y + 8; y++)
      for (let x = v.x - 8; x <= v.x + 8; x++) {
        const d = Math.hypot(x - v.x, y - v.y);
        if (inb(x, y) && d <= 7.5) observe(p.notes, x, y, d, o);
      }
  }

  function visit(v) {
    const p = G.party;
    if (v.relation < 0) {
      plog(`Passed ${v.name}. Nobody came out to meet us.`);
      render();
      return;
    }
    const buttons = [];
    if (p.gifts > 0) buttons.push({ label: 'Trade a bundle of tools for corn (+6 rations)', primary: true, act: () => { p.gifts--; p.rations += 6; v.relation = Math.min(3, v.relation + 0.5); plog(`Traded tools for corn at ${v.name}.`); closeModal(); render(); } });
    if (skill('tongue') >= 2 && v.relation >= 1) buttons.push({ label: 'Ask them about the land again', act: () => { tellOfLand(v); plog(`${v.name} described the country around them again.`); closeModal(); render(); } });
    buttons.push({ label: 'Move on', primary: !buttons.length });
    showModal({ title: LF.cap(v.name), body: `<p>The party is recognized and welcomed${v.relation >= 1 ? ' warmly' : ', carefully'}.</p>`, buttons });
  }

  // ---------------------------------------------------------------- council

  function dossier(site) {
    const K = G.K;
    const r = 4;
    let meadow = 0, forest = 0, swamp = 0, hills = 0, game = 0, unknown = 0, n = 0, qsum = 0, staleSum = 0, river = false;
    for (let y = site.y - r; y <= site.y + r; y++)
      for (let x = site.x - r; x <= site.x + r; x++) {
        const d = Math.hypot(x - site.x, y - site.y);
        if (!inb(x, y) || d > r + 0.5) continue;
        const j = idx(x, y);
        const k = K.t[j];
        if (k < 0) { unknown++; continue; }
        if (LF.isWater(k)) continue;
        n++;
        qsum += K.q[j];
        staleSum += G.day - K.seen[j];
        if (k === T.MEADOW) meadow++;
        else if (k === T.FOREST) forest++;
        else if (k === T.SWAMP) swamp++;
        else if (k === T.HILLS || k === T.MOUNTAIN) hills++;
        if (K.game[j]) game++;
        if (K.river[j] && d <= 2.5) river = true;
      }
    const onHill = K.t[idx(site.x, site.y)] === T.HILLS;
    const hb = LF.harborShelter(K.t, site.x, site.y);
    const harbor = !hb.coastal ? 0 : hb.shelter > 0.55 ? 3 : hb.shelter > 0.42 ? 2 : 1;
    const neighbors = [];
    for (const v of G.world.villages) {
      if (!v.drawn) continue;
      const d = Math.hypot(v.drawn.x - site.x, v.drawn.y - site.y);
      if (d > 14) continue;
      neighbors.push({ v, d, inside: v.territoryKnown && d <= v.radius + 0.5 });
    }
    const conf = n ? qsum / n : 0;
    return { meadow, forest, swamp, hills, game, unknown, river, onHill, harbor, shelter: hb.shelter, neighbors, conf, stale: n ? Math.round(staleSum / n) : 0 };
  }

  function ratings(d) {
    const lvl = (v, cuts, words) => { let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return words[i]; };
    return [
      ['Farmland', lvl(d.meadow, [1, 5, 10, 16], ['None drawn', 'Poor', 'Fair', 'Good', 'Rich']), d.meadow >= 10 ? 'good' : d.meadow >= 5 ? 'mid' : 'bad'],
      ['Timber', lvl(d.forest, [3, 8, 15], ['Scarce', 'Fair', 'Good', 'Plenty']), d.forest >= 8 ? 'good' : d.forest >= 3 ? 'mid' : 'bad'],
      ['Fresh water', d.river ? 'River at hand' : 'None drawn', d.river ? 'good' : 'bad'],
      ['Harbor', ['Inland', 'Open roadstead', 'Fair anchorage', 'Sheltered harbor'][d.harbor], d.harbor >= 2 ? 'good' : d.harbor === 1 ? 'mid' : 'mid'],
      ['Defense', d.onHill ? 'On high ground' : d.hills >= 5 ? 'Hills nearby' : 'Open ground', d.onHill ? 'good' : d.hills >= 5 ? 'mid' : 'mid'],
      ['Marsh', d.swamp === 0 ? 'None drawn' : d.swamp <= 3 ? 'Some low ground' : 'Much marsh', d.swamp === 0 ? 'good' : d.swamp <= 3 ? 'mid' : 'bad'],
      ['Game and furs', d.game >= 3 ? 'Plentiful' : d.game ? 'Some sign' : 'None noted', d.game >= 3 ? 'good' : 'mid'],
      ['Survey', d.unknown > 18 ? 'Largely unsurveyed' : d.conf < 0.62 ? 'Shaky' : d.conf < 0.8 ? 'Fair' : 'Sound', d.unknown > 18 || d.conf < 0.62 ? 'bad' : d.conf < 0.8 ? 'mid' : 'good'],
    ];
  }

  function officerViews() {
    const sites = G.sites.map((s) => ({ s, d: dossier(s) }));
    const score = {
      harrow: ({ d }) => d.harbor * 3 + (d.river ? 4 : 0) + Math.min(d.meadow, 16) * 0.4 - d.unknown * 0.1,
      pryce: ({ d }) => (d.onHill ? 5 : d.hills >= 5 ? 3 : 0) + (d.river ? 3 : 0) - d.swamp * 1.2 - d.neighbors.reduce((a, n) => a + (n.inside ? (n.v.promised ? 12 : 4) : 0), 0),
      voss: ({ d }) => Math.min(d.forest, 15) * 0.35 + d.game * 1.2 + d.harbor * 2.5,
    };
    const views = {};
    for (const key of Object.keys(score)) {
      const best = sites.reduce((b, x) => (!b || score[key](x) > score[key](b) ? x : b), null);
      views[key] = { site: best.s, line: officerLine(key, best.s, best.d, sites) };
    }
    return views;
  }

  function officerLine(key, s, d, all) {
    const promisedInside = all.find((x) => x.d.neighbors.some((n) => n.inside && n.v.promised));
    if (key === 'harrow') {
      if (d.harbor >= 2) return `A ship can lie safe at ${s.name}. Everything we need for the next ten years comes by sea, and I want it landed dry.`;
      if (d.river) return `${s.name} has fresh water and a place to beach the boats. I can keep a storehouse there.`;
      return `None of these are what I hoped for. ${s.name} is the least bad for getting stores ashore.`;
    }
    if (key === 'pryce') {
      if (promisedInside && promisedInside.s !== s) return `We gave our word about ${promisedInside.s.name}. It lies inside their hunting grounds. I will not bless a settlement built on a broken promise. ${s.name} will serve.`;
      if (d.onHill) return `${s.name} stands high. The ground drains, the air is clean, and we can see who comes.`;
      if (d.swamp >= 4) return `Every site here has low ground near it. ${s.name} has the least that I can see on this chart.`;
      return `${s.name} is dry ground with water nearby. Low places breed fevers, and I have buried enough men from fever.`;
    }
    if (d.game >= 3 || d.forest >= 12) return `The Company needs returns on the first ship. ${s.name} has timber and fur within a day’s walk, and water deep enough to load it.`;
    return `I need something to send home in the autumn. ${s.name} gives us the best chance of a cargo.`;
  }

  function foundColony(site) {
    G.mode = 'epilogue';
    G.result = simulate(site);
    G.reveal = false;
    chartCam = null;
    closeModal();
    render();
  }

  // ---------------------------------------------------------------- the first year

  function simulate(site) {
    const w = G.world;
    const R = LF.rng(G.seed * 7 + G.day * 13 + site.x);
    let x = site.x, y = site.y, shift = 0;
    if (LF.isWater(w.t[idx(x, y)])) {
      let best = null, bd = Infinity;
      for (let yy = 0; yy < H; yy++)
        for (let xx = 0; xx < W; xx++) {
          if (LF.isWater(w.t[idx(xx, yy)])) continue;
          const d = Math.hypot(xx - x, yy - y);
          if (d < bd) { bd = d; best = [xx, yy]; }
        }
      [x, y] = best;
      shift = Math.round(bd);
    }
    const r = 4;
    let meadow = 0, fertile = 0, forest = 0, game = 0, swamp = 0, hills = 0, water = false;
    for (let yy = y - r; yy <= y + r; yy++)
      for (let xx = x - r; xx <= x + r; xx++) {
        const d = Math.hypot(xx - x, yy - y);
        if (!inb(xx, yy) || d > r + 0.5) continue;
        const i = idx(xx, yy);
        const k = w.t[i];
        if (k === T.MEADOW) {
          meadow++;
          if (LF.N8.some(([dx, dy]) => inb(xx + dx, yy + dy) && w.river[idx(xx + dx, yy + dy)])) fertile++;
        } else if (k === T.FOREST) forest++;
        else if (k === T.SWAMP) swamp++;
        else if (k === T.HILLS || k === T.MOUNTAIN) hills++;
        if (w.game[i]) game++;
        if (w.river[i] && d <= 2.5) water = true;
      }
    const onHill = w.t[idx(x, y)] === T.HILLS;
    const hb = LF.harborShelter(w.t, x, y);

    const crew = G.crew.filter((c) => c.alive);
    const has = (id) => crew.some((c) => c.id === id);
    const soldiers = crew.filter((c) => c.role === 'Soldier').length;
    const hunterAlive = crew.some((c) => c.role === 'Hunter');
    const pop = SETTLERS + crew.length + 3;
    const defense = soldiers + (onHill ? 2 : hills >= 5 ? 1 : 0);

    const causes = [];
    const notes = { neighbors: [] };
    let trade = 0, raids = 0;
    for (const v of w.villages) {
      const d = Math.hypot(v.x - x, v.y - y);
      const inside = d <= v.radius + 0.5;
      if (inside && v.promised) {
        const n = Math.max(2, 7 - defense);
        raids += n;
        notes.neighbors.push(`The colony stood inside the hunting grounds of ${v.name}, who had been promised it would not. They did not forget. Raids through the winter killed ${num(n)}, and no one from their town would trade again.`);
      } else if (inside && v.relation <= 0) {
        const n = Math.max(1, 5 - defense);
        raids += n;
        notes.neighbors.push(`The colony was built on land that ${v.name} hunted. With no friendship to soften it, the quarrel turned to fighting. ${Num(n)} died in skirmishes.`);
      } else if (inside) {
        notes.neighbors.push(`The site lay inside the hunting grounds of ${v.name}. They stayed at peace for the sake of the friendship, but the trade that had begun at first meeting dried up.`);
      } else if (v.relation <= -2 && d <= 16) {
        const n = Math.max(1, 4 - Math.floor(defense / 2));
        raids += n;
        notes.neighbors.push(`${LF.cap(v.name)} remembered the muskets at first meeting. Their warriors watched the colony all year, and ${num(n)} settlers who strayed too far did not come back.`);
      } else if (v.relation >= 1 && d <= 22) {
        trade += 30;
        notes.neighbors.push(`${LF.cap(v.name)} traded corn for iron all winter. In the hungriest weeks that corn was the difference.`);
      } else if (v.contacted && v.relation >= 0 && d <= 22) {
        trade += 8;
        notes.neighbors.push(`${LF.cap(v.name)} traded a little, warily.`);
      }
    }
    if (raids) causes.push(['raids', raids]);

    const scurvy = Math.round(G.lateDays * 0.7);
    if (scurvy) causes.push(['scurvy', scurvy]);

    const lateFactor = Math.max(0.5, 1 - G.lateDays * 0.04);
    const farm = meadow + fertile * 1.5;
    const harvest = Math.min(pop * 5, farm * 9) * lateFactor;
    const hunting = (forest * 1.2 + game * 2) * (hunterAlive ? 1.5 : 1);
    const fishing = hb.coastal ? 20 + hb.shelter * 30 : water ? 8 : 0;
    const toolTrade = trade > 0 ? G.tools * 3 : 0;
    const food = harvest + hunting + fishing + trade + toolTrade + G.stores / 30;
    const need = pop * 6;
    const hunger = food < need ? Math.round(((need - food) / 6) * 0.45) : 0;
    if (hunger) causes.push(['hunger', hunger]);

    const fever = Math.round(swamp * 0.6 * (has('colby') ? 0.5 : 1) + R() * (swamp ? 1.5 : 0));
    if (fever) causes.push(['fever', fever]);
    const thirst = !water && !hb.coastal ? 4 : !water ? 2 : 0;
    if (thirst) causes.push(['bad water', thirst]);
    const cold = forest < 3 ? 3 : 0;
    if (cold) causes.push(['cold', cold]);

    let deaths = causes.reduce((a, c) => a + c[1], 0);
    if (deaths > pop - 4) {
      const scale = (pop - 4) / deaths;
      for (const c of causes) c[1] = Math.floor(c[1] * scale);
      deaths = causes.reduce((a, c) => a + c[1], 0);
    }

    // Name the crew among the dead.
    const pool = [...crew];
    const named = [];
    let settlersLeft = pop;
    for (let k = 0; k < deaths; k++) {
      if (pool.length && R() < pool.length / settlersLeft) named.push(pool.splice(Math.floor(R() * pool.length), 1)[0]);
      settlersLeft--;
    }

    const exports = [];
    if (hb.coastal && hb.shelter >= 0.42 && forest >= 8) exports.push('sawn timber and ship’s masts');
    if (game >= 3 || trade >= 30) exports.push('beaver pelts');
    if (fertile >= 4 && hb.coastal) exports.push('tobacco');
    const resupply = exports.length >= 2;

    const survivors = pop - deaths;
    const rate = survivors / pop;
    const verdict = rate >= 0.9 && resupply ? 'thrived' : rate >= 0.75 ? 'endured' : rate >= 0.55 ? 'held on' : 'failed';

    return { site, x, y, shift, pop, deaths, survivors, causes, named, exports, resupply, verdict, notes, stats: { meadow, fertile, forest, game, swamp, hills, water, onHill, coastal: hb.coastal, shelter: hb.shelter, harvest: Math.round(harvest), food: Math.round(food), need } };
  }

  function discrepancies(res) {
    const w = G.world;
    const pairs = new Map();
    let unknown = 0;
    for (let y = res.y - 4; y <= res.y + 4; y++)
      for (let x = res.x - 4; x <= res.x + 4; x++) {
        if (!inb(x, y) || Math.hypot(x - res.x, y - res.y) > 4.5) continue;
        const j = idx(x, y);
        const drawn = G.K.t[j], truth = w.t[j];
        if (drawn < 0) { unknown++; continue; }
        const dw = drawn === T.DEEP ? T.SEA : drawn;
        const tr = truth === T.DEEP ? T.SEA : truth;
        if (dw === tr) continue;
        const key = dw + ':' + tr;
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
    const lines = [...pairs.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => {
      const [a, b] = k.split(':').map(Number);
      return `${Num(n)} square mile${n > 1 ? 's' : ''} drawn as ${LF.T_NAME[a].toLowerCase()} ${n > 1 ? 'were' : 'was'} ${LF.T_NAME[b].toLowerCase()}.`;
    });
    if (unknown) lines.push(`${Num(unknown)} square mile${unknown > 1 ? 's' : ''} around the site had never been surveyed at all.`);
    return lines;
  }

  function bearing(dx, dy) {
    const dirs = ['east', 'southeast', 'south', 'southwest', 'west', 'northwest', 'north', 'northeast'];
    const a = Math.atan2(dy, dx);
    return dirs[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  }

  function epilogueText(res) {
    const s = res.site, st = res.stats;
    const out = [];
    let landing = `On day ${G.day} the Constant weighed anchor and carried ${res.pop} people to ${s.name}.`;
    if (res.shift) landing += ` The position in the survey fell in open water. The boats went ashore at the nearest land, ${num(res.shift)} mile${res.shift > 1 ? 's' : ''} off.`;
    else if (!s.isLanding && (s.tx !== s.x || s.ty !== s.y)) {
      const d = Math.round(Math.hypot(s.tx - s.x, s.ty - s.y));
      landing += ` They found the place the chart described, but not the stake. It stood ${num(d)} mile${d > 1 ? 's' : ''} to the ${bearing(s.tx - s.x, s.ty - s.y)}, where the survey party had really been. Their reckoning had drifted.`;
    }
    out.push(landing);

    let ground;
    if (st.meadow + st.fertile >= 14) ground = `The ground was as good as anyone hoped. The first planting went into open meadow${st.fertile >= 4 ? ' and dark river soil' : ''}, and the harvest came in heavy.`;
    else if (st.meadow >= 6) ground = 'There was enough open ground to plant, though not enough to plant everyone’s share. The harvest was thin.';
    else ground = `There was almost no open ground. The settlers spent the summer girdling trees and burning stumps, and the harvest was a fraction of what they needed.`;
    if (st.swamp >= 4) ground += ' The low ground around the site was marsh, and by August the fevers came.';
    out.push(ground);

    let water = st.water ? 'The river gave good water all year.' : st.coastal ? 'There was no river nearby. The wells came up brackish, and the flux went through the houses in the heat.' : 'There was no river nearby, and the wells ran dry in August.';
    if (st.coastal) water += st.shelter > 0.55 ? ' The anchorage was well sheltered and the boats fished every calm day.' : st.shelter > 0.42 ? ' The anchorage was fair.' : ' The anchorage lay open to the east, and two boats were lost in autumn gales.';
    else water += ' Every barrel of stores had to be hauled overland from the coast.';
    out.push(water);

    if (res.notes.neighbors.length) out.push(res.notes.neighbors.join(' '));

    const causeText = res.causes.filter((c) => c[1] > 0).map(([c, n]) => `${num(n)} to ${c}`);
    let winter = res.deaths
      ? `By spring, ${res.deaths} of the ${res.pop} had died: ${listJoin(causeText)}.`
      : 'By spring, every one of them was still alive.';
    if (res.named.length) winter += ` Among the dead were ${listJoin(res.named.map((m) => m.name))}.`;
    out.push(winter);

    const ship = res.resupply
      ? `The supply ship came in May and left with ${listJoin(res.exports)}. The Company wrote that it would send another fleet.`
      : res.exports.length
      ? `The supply ship came in May and took on ${res.exports[0]}, not enough to cover the cost of the voyage. Voss’s letter home was careful.`
      : 'The supply ship came in May and left nearly empty. The Company wrote that it would not send another.';
    out.push(ship);
    return out;
  }

  const VERDICTS = {
    thrived: ['The colony thrived', 'A full hold went home and more settlers are coming.'],
    endured: ['The colony endured', 'It was a hard year, but the town is still standing.'],
    'held on': ['The colony barely held on', 'The survivors will need a better year, and soon.'],
    failed: ['The colony failed', 'In June the survivors boarded the supply ship and sailed for home.'],
  };

  // ---------------------------------------------------------------- rendering

  let chartCam = null;
  const cv = () => $('#cv');

  function fitChart() {
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    const cw = c.width / dpr, ch = c.height / dpr;
    const s = Math.min((cw - 16) / W, (ch - 16) / H);
    chartCam = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr };
  }

  function sizeCanvas() {
    const c = cv();
    const stage = $('#stage');
    const dpr = window.devicePixelRatio || 1;
    const r = stage.getBoundingClientRect();
    const w = Math.max(200, Math.floor(r.width)), h = Math.max(200, Math.floor(r.height));
    if (c.width !== w * dpr || c.height !== h * dpr) {
      c.width = w * dpr;
      c.height = h * dpr;
      c.style.width = w + 'px';
      c.style.height = h + 'px';
      chartCam = null;
    }
  }

  let hover = null, hoverPath = null;

  function drawStage() {
    sizeCanvas();
    const c = cv();
    const dpr = window.devicePixelRatio || 1;
    if (G.mode === 'field' && !G.showMap) {
      const p = G.party;
      const s = clamp(Math.min(c.width, c.height) / dpr / 13, 26, 60);
      fieldCam = { s, dpr, cx: p.x, cy: p.y };
      LF.drawField(c, { world: G.world, party: p, cam: fieldCam, time: performance.now(), hover, path: hoverPath, stakes: p.stakes, camp: G.world.camp, ship: G.world.ship });
      return;
    }
    if (!chartCam) fitChart();
    chartCam.dpr = dpr;
    const opts = {
      K: G.K,
      day: G.day,
      cam: chartCam,
      villages: G.world.villages,
      sites: G.sites,
      camp: G.world.camp,
      title: `A Chart of the Coast, Day ${G.day}`,
    };
    if (G.mode === 'field') {
      opts.notes = G.party.notes;
      opts.party = G.party;
      opts.title = 'The chart, with field notes in pencil';
    }
    if (G.mode === 'council' && G.councilFocus) opts.highlight = { x: G.councilFocus.x, y: G.councilFocus.y, r: 4.5 };
    if (G.mode === 'epilogue') {
      const res = G.result;
      opts.highlight = { x: res.x, y: res.y, r: 4.5 };
      if (G.reveal) {
        opts.truth = G.world;
        opts.title = 'The land as it was';
      } else opts.title = 'The chart the council used';
    }
    LF.drawChart(c, opts);
  }
  let fieldCam = null;

  function ledger() {
    const atCamp = G.crew.filter((c) => c.alive && !c.away).length;
    const alive = G.crew.filter((c) => c.alive).length;
    const left = DEADLINE - G.day;
    const dayClass = left < 0 ? 'bad' : left <= 7 ? 'warn' : '';
    return `
      <div class="chip ${dayClass}"><span class="k">Day</span><span class="v">${G.day}<small> / ${DEADLINE}</small></span></div>
      <div class="chip ${G.stores < 60 ? 'warn' : ''}"><span class="k">Stores</span><span class="v">${Math.floor(G.stores)}<small> rations</small></span></div>
      <div class="chip"><span class="k">Trade tools</span><span class="v">${G.tools}</span></div>
      <div class="chip"><span class="k">At camp</span><span class="v">${atCamp}<small> / ${alive} crew</small></span></div>`;
  }

  function pips(n, max, cls) {
    let s = '';
    for (let i = 0; i < max; i++) s += `<i class="${i < n ? 'on' : ''} ${cls || ''}"></i>`;
    return `<span class="pips" aria-label="${n} of ${max}">${s}</span>`;
  }

  function crewRow(m) {
    const status = !m.alive ? '<span class="tag bad">Dead</span>' : m.away ? '<span class="tag">In the field</span>' : m.health < 3 ? '<span class="tag warn">Hurt</span>' : '';
    const best = SKILLS.filter(([k]) => m[k] > 0).map(([k, l]) => `${l} ${m[k]}`).join(' · ');
    return `<li class="${m.alive ? '' : 'dead'}"><div><strong>${esc(m.name)}</strong> <span class="role">${m.role}</span></div><div class="sub">${best} ${status}</div></li>`;
  }

  function panelCamp() {
    const late = G.day > DEADLINE;
    const sites = G.sites.map((s) => `<li><span class="seal">${s.letter}</span><div><strong>${esc(s.name)}</strong><div class="sub">Staked by ${esc(s.by)}, day ${s.day}</div></div></li>`).join('');
    const journal = G.journal.slice(-6).reverse().map((j) => `<li><span class="d">Day ${j.day}</span> ${esc(j.text)}</li>`).join('');
    const anyone = G.crew.some((c) => c.alive);
    return `
      <h2>The map table</h2>
      <p class="lede">${late
        ? 'The deadline has passed. The settlers cannot wait aboard any longer. Convene the council and choose.'
        : `The master sails in <strong>${DEADLINE - G.day} days</strong>. Send parties inland to survey, stake out candidate sites, then convene the council to choose where ${SETTLERS + 3 + G.crew.filter((c) => c.alive).length} people will spend the winter.`}</p>
      <div class="actions">
        <button class="btn primary" id="b-outfit" ${late || !anyone ? 'disabled' : ''}>Outfit an expedition</button>
        <button class="btn" id="b-council">Convene the council</button>
      </div>
      <p class="hint">Everything on this chart was drawn by your own people, or copied from an older chart of the coast. Faint ink and question marks mean the surveyor was unsure.</p>
      <h3>Candidate sites</h3>
      <ul class="sites">${sites}</ul>
      <h3>Crew</h3>
      <ul class="crew">${G.crew.map(crewRow).join('')}</ul>
      <h3>Journal</h3>
      <ul class="journal">${journal}</ul>
      <button class="btn ghost small" id="b-new">Start over with a new coast</button>`;
  }

  function panelField() {
    const p = G.party, w = G.world;
    const alive = aliveMembers();
    const here = w.t[idx(p.x, p.y)];
    const dx = w.camp.x - p.x, dy = w.camp.y - p.y;
    const dist = Math.round(Math.hypot(dx, dy));
    const daysFood = alive.length ? Math.floor(p.rations / alive.length) : 0;
    const riverHere = w.river[idx(p.x, p.y)];
    const log = p.log.slice(-7).reverse().map((l) => `<li><span class="d">Day ${l.day}</span> ${esc(l.text)}</li>`).join('');
    const membersHtml = p.members.map((id) => {
      const m = G.crew.find((c) => c.id === id);
      return `<li class="${m.alive ? '' : 'dead'}"><div><strong>${esc(m.name)}</strong> <span class="role">${m.role}</span></div><div class="sub">${m.alive ? pips(m.health, 3, 'hp') : 'Dead'}</div></li>`;
    }).join('');
    const remaining = Math.max(0, DAYLIGHT - p.hours);
    return `
      <h2>In the field</h2>
      <div class="daylight" aria-label="${remaining} hours of daylight left"><div style="width:${(remaining / DAYLIGHT) * 100}%"></div><span>${remaining} hours of daylight left</span></div>
      <dl class="facts">
        <dt>Standing in</dt><dd>${LF.T_NAME[here]}${riverHere ? ', by a river' : ''}</dd>
        <dt>Food</dt><dd class="${daysFood <= 2 ? 'bad' : ''}">${Math.floor(p.rations)} rations, about ${num(daysFood)} day${daysFood === 1 ? '' : 's'}</dd>
        <dt>Trade tools</dt><dd>${p.gifts}</dd>
        <dt>The landing</dt><dd>${dist ? `${dist} miles ${bearing(dx, dy)}` : 'Here'}</dd>
      </dl>
      <div class="actions">
        <button class="btn primary" id="b-home">Head back to the landing</button>
        <button class="btn" id="b-stake">Plant a survey stake</button>
        <button class="btn" id="b-map">${G.showMap ? 'Put the chart away' : 'Consult the chart'}</button>
        <button class="btn" id="b-rest">Make camp for the night</button>
      </div>
      <p class="hint">Arrow keys or WASD walk one mile. Tap or click any ground you can see to walk there. Each night the party eats one ration each.</p>
      <h3>Party</h3>
      <ul class="crew">${membersHtml}</ul>
      <h3>Field notes</h3>
      <ul class="journal">${log}</ul>`;
  }

  function panelCouncil() {
    const views = officerViews();
    const cards = G.sites.map((s) => {
      const d = dossier(s);
      const fans = Object.entries(views).filter(([, v]) => v.site === s).map(([k]) => OFFICERS[k].name.split(' ').slice(-1)[0]);
      const rows = ratings(d).map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls}">${v}</dd>`).join('');
      const nb = d.neighbors.map((n) => `<li>${esc(LF.cap(n.v.name))}, ${Math.round(n.d)} miles${n.inside ? `. <strong class="bad">Inside their hunting grounds${n.v.promised ? ', which you promised to leave alone' : ''}.</strong>` : '.'}</li>`).join('');
      return `<article class="dossier" data-site="${s.letter}">
        <header><span class="seal">${s.letter}</span><div><h4>${esc(s.name)}</h4><div class="sub">Surveyed by ${esc(s.by)}, day ${s.day}${d.stale > 10 ? `. The chart here is ${d.stale} days old.` : ''}</div></div></header>
        <dl class="facts">${rows}</dl>
        ${nb ? `<ul class="neighbors">${nb}</ul>` : ''}
        ${fans.length ? `<p class="fans">Favored by ${fans.join(' and ')}</p>` : ''}
        <button class="btn primary" data-found="${s.letter}">Settle here</button>
      </article>`;
    }).join('');
    const talk = Object.entries(views).map(([k, v]) => `<blockquote><p>“${esc(v.line)}”</p><cite>${OFFICERS[k].name}, ${OFFICERS[k].role.toLowerCase()}</cite></blockquote>`).join('');
    return `
      <h2>The council</h2>
      <p class="lede">The officers argue over the chart. Every report below comes from the chart alone, and the chart may be wrong.</p>
      <div class="talk">${talk}</div>
      <div class="dossiers">${cards}</div>
      <button class="btn ghost" id="b-back">Back to the map table</button>`;
  }

  function panelEpilogue() {
    const res = G.result;
    const [title, sub] = VERDICTS[res.verdict];
    const paras = epilogueText(res).map((t) => `<p>${esc(t)}</p>`).join('');
    const disc = discrepancies(res);
    return `
      <p class="eyebrow">The first year at ${esc(res.site.name)}</p>
      <h2 class="verdict ${res.verdict.replace(' ', '-')}">${title}</h2>
      <p class="lede">${sub}</p>
      <div class="tally"><div><span class="v">${res.survivors}</span><span class="k">alive in spring</span></div><div><span class="v">${res.deaths}</span><span class="k">dead</span></div><div><span class="v">${res.resupply ? 'Yes' : 'No'}</span><span class="k">resupplied</span></div></div>
      <div class="story">${paras}</div>
      <h3>What the chart got wrong</h3>
      ${disc.length ? `<ul class="journal">${disc.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '<p>Around the site, the chart was right in every particular. The surveyors earned their pay.</p>'}
      <div class="actions">
        <button class="btn" id="b-reveal">${G.reveal ? 'Show our chart' : 'Show the land as it was'}</button>
        <button class="btn primary" id="b-new">Found another colony</button>
      </div>`;
  }

  function render() {
    $('#ledger').innerHTML = ledger();
    const panel = $('#panel');
    const html = G.mode === 'camp' ? panelCamp() : G.mode === 'field' ? panelField() : G.mode === 'council' ? panelCouncil() : panelEpilogue();
    panel.innerHTML = html;
    panel.dataset.mode = G.mode;
    $('#app').dataset.mode = G.mode;
    wirePanel();
    drawStage();
    $('#zoom').hidden = G.mode === 'field' && !G.showMap;
  }

  function wirePanel() {
    const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
    on('b-outfit', outfit);
    on('b-council', () => {
      if (G.party) return;
      G.mode = 'council';
      G.councilFocus = null;
      render();
    });
    on('b-back', () => { G.mode = 'camp'; render(); });
    on('b-new', () => confirmNew());
    on('b-home', walkHome);
    on('b-stake', plantStake);
    on('b-map', () => { G.showMap = !G.showMap; render(); });
    on('b-rest', makeCamp);
    on('b-reveal', () => { G.reveal = !G.reveal; render(); });
    document.querySelectorAll('[data-found]').forEach((b) => {
      b.onclick = () => {
        const s = G.sites.find((x) => x.letter === b.dataset.found);
        showModal({
          title: `Settle at ${s.name}?`,
          body: `<p>The Constant will sail to ${esc(s.name)} and put every settler ashore. There is no second choice.</p>${G.day < DEADLINE ? `<p class="muted">You still have ${DEADLINE - G.day} days left to survey.</p>` : ''}`,
          buttons: [{ label: 'Found the colony', primary: true, act: () => foundColony(s) }, { label: 'Not yet' }],
        });
      };
    });
    document.querySelectorAll('.dossier').forEach((el) => {
      el.onmouseenter = () => { G.councilFocus = G.sites.find((x) => x.letter === el.dataset.site); drawStage(); };
      el.onfocusin = el.onmouseenter;
    });
  }

  function confirmNew() {
    if (G.mode === 'epilogue') return newGame((Math.random() * 1e9) | 0);
    showModal({
      title: 'Start over?',
      body: '<p>This abandons the current voyage and generates a new coast.</p>',
      buttons: [{ label: 'Start over', primary: true, act: () => newGame((Math.random() * 1e9) | 0) }, { label: 'Keep playing' }],
    });
  }

  // ---------------------------------------------------------------- outfitting

  function outfit() {
    if (G.party || G.day > DEADLINE) return;
    const avail = G.crew.filter((c) => c.alive);
    const pickDefault = new Set(avail.filter((c) => ['hale', 'crane', 'rowe'].includes(c.id)).map((c) => c.id));
    const cards = avail.map((m) => `
      <label class="pick">
        <input type="checkbox" name="crew" value="${m.id}" id="pick-${m.id}" ${pickDefault.has(m.id) ? 'checked' : ''}>
        <span class="card">
          <span class="top"><strong>${esc(m.name)}</strong><span class="role">${m.role}</span></span>
          <span class="skills">${SKILLS.filter(([k]) => m[k] > 0).map(([k, l]) => `<span>${l} ${pips(m[k], 3)}</span>`).join('')}</span>
          <span class="note">${esc(m.note)}${m.health < 3 ? ` <em class="warn">Still hurt.</em>` : ''}</span>
        </span>
      </label>`).join('');
    showModal({
      title: 'Outfit an expedition',
      wide: true,
      body: `
        <p class="muted">Choose two to four people. Whoever goes is not at camp foraging, and whatever they carry comes out of the stores.</p>
        <div class="picks">${cards}</div>
        <div class="sliders">
          <label for="o-days">Days of food <output id="o-days-v"></output></label>
          <input type="range" id="o-days" min="2" max="14" value="7">
          <label for="o-gifts">Bundles of trade tools <output id="o-gifts-v"></output></label>
          <input type="range" id="o-gifts" min="0" max="${Math.min(4, G.tools)}" value="${Math.min(2, G.tools)}">
        </div>
        <p id="o-sum" class="summary"></p>`,
      buttons: [{ label: 'Set out', primary: true, id: 'o-go', keep: true, act: () => {
        const ids = [...document.querySelectorAll('input[name=crew]:checked')].map((i) => i.value);
        const days = +$('#o-days').value, gifts = +$('#o-gifts').value;
        if (ids.length < 2 || ids.length > 4) return;
        if (days * ids.length > G.stores) return;
        launch(ids, days, gifts);
      } }, { label: 'Cancel' }],
    });
    const upd = () => {
      const ids = [...document.querySelectorAll('input[name=crew]:checked')].map((i) => i.value);
      const days = +$('#o-days').value, gifts = +$('#o-gifts').value;
      $('#o-days-v').textContent = days;
      $('#o-gifts-v').textContent = gifts;
      const party = ids.map((id) => G.crew.find((c) => c.id === id));
      const has = (k) => party.some((m) => m[k] >= 2);
      const warn = [];
      if (!has('survey')) warn.push('No trained surveyor: the chart will be rough and distances will drift.');
      if (!has('tongue')) warn.push('No one to translate at a first meeting.');
      if (!has('forage')) warn.push('No hunter: the party lives only on what it carries.');
      const rations = days * ids.length;
      let msg;
      if (ids.length < 2) msg = 'Pick at least two people.';
      else if (ids.length > 4) msg = 'Four at most. A larger party eats too fast.';
      else if (rations > G.stores) msg = `That is ${rations} rations, and the stores hold only ${Math.floor(G.stores)}.`;
      else msg = `${Num(ids.length)} people carrying ${rations} rations. Food for ${days} days, so about ${Math.floor(days / 2)} days out before turning back.`;
      $('#o-sum').innerHTML = esc(msg) + (warn.length && ids.length >= 2 && ids.length <= 4 ? `<span class="warns">${warn.map(esc).join('<br>')}</span>` : '');
      $('#o-go').disabled = ids.length < 2 || ids.length > 4 || rations > G.stores;
    };
    document.querySelectorAll('#modal input').forEach((i) => (i.oninput = upd));
    upd();
  }

  // ---------------------------------------------------------------- walking

  let walkTimer = null;
  function stopWalk() {
    if (walkTimer) clearTimeout(walkTimer);
    walkTimer = null;
  }
  function walk(path) {
    stopWalk();
    const stepNext = () => {
      if (!path.length || !G.party) return stopWalk();
      const [x, y] = path.shift();
      const ok = tryStep(x - G.party.x, y - G.party.y);
      if (ok && path.length) walkTimer = setTimeout(stepNext, 110);
      else walkTimer = null;
    };
    stepNext();
  }

  function findPath(from, to, allowed) {
    const dist = new Float32Array(W * H).fill(Infinity);
    const prev = new Int32Array(W * H).fill(-1);
    const start = idx(from.x, from.y), goal = idx(to.x, to.y);
    dist[start] = 0;
    const heap = [[0, start]];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i]) continue;
      if (i === goal) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of LF.N4) {
        const ax = x + dx, ay = y + dy;
        if (!inb(ax, ay)) continue;
        const j = idx(ax, ay);
        if (LF.isWater(G.world.t[j]) || !allowed(j)) continue;
        const nd = d + stepCost(ax, ay, x, y);
        if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push([nd, j]); }
      }
    }
    if (dist[goal] === Infinity) return null;
    const path = [];
    for (let i = goal; i !== start; i = prev[i]) path.push([i % W, (i / W) | 0]);
    path.reverse();
    return { path, cost: dist[goal] };
  }

  function walkHome() {
    const p = G.party;
    if (!p || modalOpen()) return;
    const res = findPath(p, G.world.camp, (j) => p.seen.has(j));
    if (!res) return toast('The party cannot find its way back along known ground.');
    walk(res.path);
  }

  // ---------------------------------------------------------------- modal & toast

  function modalOpen() {
    return !$('#modal').hidden;
  }
  function showModal({ title, body, buttons, wide, locked }) {
    const m = $('#modal');
    m.querySelector('.modal').classList.toggle('wide', !!wide);
    m.dataset.locked = locked ? '1' : '';
    $('#modal-body').innerHTML = `<h2>${esc(title)}</h2><div class="mb">${body}</div><div class="mbtns"></div>`;
    const bar = $('#modal-body .mbtns');
    for (const b of buttons || [{ label: 'Close', primary: true }]) {
      const el = document.createElement('button');
      el.className = 'btn' + (b.primary ? ' primary' : '');
      el.textContent = b.label;
      if (b.id) el.id = b.id;
      el.onclick = () => {
        if (!b.keep) closeModal();
        if (b.act) b.act();
      };
      bar.appendChild(el);
    }
    m.hidden = false;
    const f = bar.querySelector('.primary') || bar.querySelector('button');
    if (f) f.focus({ preventScroll: true });
  }
  function closeModal() {
    $('#modal').hidden = true;
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 2600);
  }

  function intro() {
    showModal({
      title: 'Landfall',
      body: `
        <p>The <em>Constant</em> rides at anchor off a coast no one aboard has walked. Below decks are thirty settlers who have been at sea for eleven weeks.</p>
        <p>The master will wait forty days, then he must sail for home. Before then you must choose where the colony will spend its first winter. Choose well and it survives. Choose badly and you will bury people.</p>
        <p>You have a chart, but most of it is blank, and the parts that are drawn came from an older voyage. Your surveyors will fill it in. They will not always get it right.</p>
        <ol class="howto">
          <li><strong>Outfit an expedition</strong> from your crew. Their skills decide what they can do and how accurately they draw.</li>
          <li><strong>Walk the land.</strong> You see the true country only where the party stands. Their notes go onto the chart when they get back.</li>
          <li><strong>Plant survey stakes</strong> at places worth settling.</li>
          <li><strong>Convene the council</strong> and choose a site using only the chart.</li>
        </ol>`,
      buttons: [{ label: 'Go to the map table', primary: true }],
    });
  }

  // ---------------------------------------------------------------- input

  function tileAt(ev) {
    const c = cv();
    const r = c.getBoundingClientRect();
    const mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const p = G.party;
    const s = fieldCam.s;
    const ox = r.width / 2 - (fieldCam.cx + 0.5) * s, oy = r.height / 2 - (fieldCam.cy + 0.5) * s;
    return [Math.floor((mx - ox) / s), Math.floor((my - oy) / s), p];
  }

  function visibleNow(x, y) {
    const p = G.party;
    return inb(x, y) && Math.hypot(x - p.x, y - p.y) <= LF.sightRadius(G.world.t[idx(p.x, p.y)]) + 0.01;
  }

  function setupInput() {
    const c = cv();
    let drag = null;
    c.addEventListener('pointerdown', (ev) => {
      if (G.mode === 'field' && !G.showMap) return;
      drag = { x: ev.clientX, y: ev.clientY, ox: chartCam.ox, oy: chartCam.oy, moved: false };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      if (drag) {
        const dx = ev.clientX - drag.x, dy = ev.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        chartCam.ox = drag.ox + dx;
        chartCam.oy = drag.oy + dy;
        drawStage();
        return;
      }
      if (G.mode === 'field' && !G.showMap && G.party && ev.pointerType === 'mouse') {
        const [x, y] = tileAt(ev);
        if (hover && hover[0] === x && hover[1] === y) return;
        hover = [x, y];
        hoverPath = null;
        if (visibleNow(x, y) && !LF.isWater(G.world.t[idx(x, y)]) && (x !== G.party.x || y !== G.party.y)) {
          const res = findPath(G.party, { x, y }, (j) => visibleNow(j % W, (j / W) | 0));
          if (res) {
            hoverPath = res.path;
            showHoverInfo(x, y, res.cost);
          } else showHoverInfo(x, y);
        } else showHoverInfo(x, y);
        drawStage();
      }
    });
    c.addEventListener('pointerup', () => { drag = null; });
    c.addEventListener('pointerleave', () => { hover = null; hoverPath = null; $('#tip').hidden = true; if (G.mode === 'field' && !G.showMap) drawStage(); });
    c.addEventListener('click', (ev) => {
      if (G.mode !== 'field' || G.showMap || !G.party || modalOpen()) return;
      const [x, y] = tileAt(ev);
      if (!visibleNow(x, y) || LF.isWater(G.world.t[idx(x, y)])) return;
      const res = findPath(G.party, { x, y }, (j) => visibleNow(j % W, (j / W) | 0));
      hoverPath = null;
      if (res) walk(res.path);
    });
    c.addEventListener('wheel', (ev) => {
      if (G.mode === 'field' && !G.showMap) return;
      ev.preventDefault();
      const r = c.getBoundingClientRect();
      zoomAt(ev.clientX - r.left, ev.clientY - r.top, ev.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });

    $('#z-in').onclick = () => { const r = c.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.3); };
    $('#z-out').onclick = () => { const r = c.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.3); };
    $('#z-fit').onclick = () => { chartCam = null; drawStage(); };

    window.addEventListener('keydown', (ev) => {
      if (modalOpen()) {
        if (ev.key === 'Escape' && !$('#modal').dataset.locked) closeModal();
        return;
      }
      if (G.mode !== 'field' || !G.party) return;
      if (ev.target && /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
      const k = ev.key.toLowerCase();
      const dir = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
      if (dir) {
        ev.preventDefault();
        stopWalk();
        if (G.showMap) { G.showMap = false; }
        tryStep(dir[0], dir[1]);
        render();
      } else if (k === 'm') { G.showMap = !G.showMap; render(); }
    });

    window.addEventListener('resize', () => { chartCam = null; drawStage(); });
  }

  function showHoverInfo(x, y, cost) {
    const tip = $('#tip');
    if (!visibleNow(x, y)) { tip.hidden = true; return; }
    const w = G.world;
    const k = w.t[idx(x, y)];
    let s = LF.T_NAME[k] + (w.river[idx(x, y)] ? ', river' : '');
    if (cost) s += ` · ${cost} hours on foot`;
    tip.textContent = s;
    tip.hidden = false;
  }

  function zoomAt(mx, my, f) {
    if (!chartCam) fitChart();
    const ns = clamp(chartCam.s * f, 4, 48);
    const k = ns / chartCam.s;
    chartCam.ox = mx - (mx - chartCam.ox) * k;
    chartCam.oy = my - (my - chartCam.oy) * k;
    chartCam.s = ns;
    drawStage();
  }

  // Gentle animation for water and chimney smoke while in the field.
  function tick() {
    if (G && G.mode === 'field' && !G.showMap && !document.hidden) drawStage();
    setTimeout(() => requestAnimationFrame(tick), 120);
  }

  function boot() {
    setupInput();
    newGame((Math.random() * 1e9) | 0);
    intro();
    tick();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => G && drawStage());
  }

  LF.debug = () => G;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
