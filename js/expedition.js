// Expeditions: outfitting, walking the land, nights in camp, and what happens out there.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, esc, clamp, num, Num, first, last, listJoin } = LF;
  const $ = LF.$;
  const G = () => LF.G;

  const DUSK = 18;
  const LAST_HOUR = 23;

  // ---------------------------------------------------------------- party helpers

  const members = () => (G().party ? G().party.members.map(LF.crewById) : []);
  const alive = () => members().filter((m) => m.alive);
  LF.partyAlive = alive;
  function skill(key) {
    const p = G().party;
    let b = alive().reduce((b, m) => Math.max(b, m[key]), 0);
    if (p && p.guide !== null && p.guide !== undefined) {
      if (key === 'forage') b = Math.max(b, 2);
      if (key === 'tongue') b = Math.max(b, 2);
    }
    return b;
  }
  const bestAt = (key) => alive().reduce((b, m) => (!b || m[key] > b[key] ? m : b), null);
  const anyTrait = (t) => alive().some((m) => LF.hasTrait(m, t));
  const withTrait = (t) => alive().find((m) => LF.hasTrait(m, t));
  const R = () => G().party.rng();
  const plog = (text) => G().party.log.push({ day: G().day, hour: G().party.hour, text });
  const here = () => G().world.t[idx(G().party.x, G().party.y)];
  const avgFatigue = () => { const a = alive(); return a.length ? a.reduce((s, m) => s + m.fatigue, 0) / a.length : 0; };

  function sightRadius() {
    const p = G().party;
    const k = here();
    let r = LF.T_SIGHT[k] || 3;
    if (p.canoeOn) r = 5.5;
    if (anyTrait('keeneyed')) r += 1;
    if (p.hour >= DUSK + 1) r = Math.min(r, 1.6);
    else if (p.hour >= DUSK) r = Math.min(r, 3.5);
    else if (p.hour >= DUSK - 1) r -= 1;
    return Math.max(1.6, r);
  }
  LF.partySight = sightRadius;
  function light() {
    const h = G().party.hour;
    if (h < 16) return 1;
    if (h < DUSK) return 1 - ((h - 16) / 2) * 0.45;
    if (h < DUSK + 1) return 0.55 - (h - DUSK) * 0.3;
    return 0.15;
  }
  function clockText(h) {
    const hh = Math.floor(h), mm = Math.round((h - hh) * 60 / 15) * 15;
    const H12 = ((hh + 11) % 12) + 1;
    return `${H12}:${String(mm % 60).padStart(2, '0')} ${hh >= 12 && hh < 24 ? 'pm' : 'am'}`;
  }

  // ---------------------------------------------------------------- outfitting

  LF.outfit = function () {
    const g = G();
    if (g.party || g.day > LF.DEADLINE) return;
    const avail = g.crew.filter((c) => c.alive);
    const picked = new Set(avail.filter((c) => ['hale', 'crane', 'rowe'].includes(c.id)).map((c) => c.id));
    const gear = { rations: 0, tools: Math.min(2, g.stores.tools), beads: Math.min(4, g.stores.beads), cloth: 0, powder: Math.min(3, g.stores.powder), medicine: Math.min(2, g.stores.medicine), compass: g.stores.compass ? 1 : 0, canoe: 0, tent: g.stores.tent ? 1 : 0 };
    let pace = 'steady';
    let days = 6;

    const cards = avail.map((m) => `
      <label class="pick">
        <input type="checkbox" name="crew" value="${m.id}" id="pick-${m.id}" ${picked.has(m.id) ? 'checked' : ''}>
        <span class="card">
          <span class="top"><strong>${esc(m.name)}</strong><span class="role">${esc(m.role)}</span></span>
          <span class="skills">${LF.SKILLS.filter(([k]) => m[k] > 0).map(([k, l]) => `<span>${l} ${LF.pips(m[k], 3)}</span>`).join('')}</span>
          <span class="traits">${LF.traitTags(m)}</span>
          <span class="note">${esc(m.note)}${m.health < 3 ? ' <em class="warn">Still hurt.</em>' : ''}</span>
        </span>
      </label>`).join('');
    const gearRows = LF.GEAR_ORDER.filter((k) => k !== 'rations').map((k) => {
      const d = LF.GEAR[k];
      return `<div class="gear-row" data-k="${k}">
        <div class="gname"><strong>${esc(d.name)}</strong><span>${esc(d.desc)}</span></div>
        <div class="gw">${d.weight} lb</div>
        <div class="stepper"><button class="btn icon sm" data-d="-1" aria-label="Fewer ${esc(d.name)}">−</button><output id="g-${k}">0</output><button class="btn icon sm" data-d="1" aria-label="More ${esc(d.name)}">+</button></div>
        <div class="gs">of ${Math.floor(g.stores[k])}</div>
      </div>`;
    }).join('');
    const paces = Object.entries(LF.PACES).map(([k, v]) => `<label class="radio"><input type="radio" name="pace" value="${k}" id="pace-${k}" ${k === pace ? 'checked' : ''}><span><strong>${v.name}</strong><em>${v.desc}</em></span></label>`).join('');

    LF.showModal({
      title: 'Outfit an expedition',
      wide: true,
      kind: 'outfit',
      body: `
        <section><h3 class="mh">The party</h3><p class="muted">Two to five people. Whoever goes is not working at the landing.</p><div class="picks">${cards}</div></section>
        <section><h3 class="mh">Food</h3>
          <div class="sliders"><label for="o-days">Days of food <output id="o-days-v"></output></label><input type="range" id="o-days" min="2" max="14" value="${days}"></div></section>
        <section><h3 class="mh">Gear</h3><div class="gear">${gearRows}</div>
          <div class="loadbar"><div id="o-load"></div><span id="o-load-t"></span></div></section>
        <section><h3 class="mh">Pace</h3><div class="radios row">${paces}</div></section>
        <p id="o-sum" class="summary"></p>`,
      buttons: [
        { label: 'Set out', primary: true, id: 'o-go', keep: true, act: () => {
          const ids = [...document.querySelectorAll('input[name=crew]:checked')].map((i) => i.value);
          if (!valid(ids)) return;
          LF.closeModal();
          launch(ids, { ...gear, rations: days * ids.length }, pace);
        } },
        { label: 'Cancel' },
      ],
    });

    const valid = (ids) => {
      const rations = days * ids.length;
      const weight = LF.GEAR_ORDER.reduce((s, k) => s + (k === 'rations' ? rations : gear[k]) * LF.GEAR[k].weight, 0);
      return ids.length >= 2 && ids.length <= 5 && rations <= g.stores.rations && weight <= ids.length * LF.CARRY && !(gear.canoe && ids.length < 2);
    };
    const upd = () => {
      const ids = [...document.querySelectorAll('input[name=crew]:checked')].map((i) => i.value);
      days = +$('#o-days').value;
      pace = (document.querySelector('input[name=pace]:checked') || {}).value || 'steady';
      $('#o-days-v').textContent = days;
      for (const k of LF.GEAR_ORDER) if (k !== 'rations') $('#g-' + k).textContent = gear[k];
      const rations = days * ids.length;
      const weight = LF.GEAR_ORDER.reduce((s, k) => s + (k === 'rations' ? rations : gear[k]) * LF.GEAR[k].weight, 0);
      const cap = Math.max(1, ids.length * LF.CARRY);
      const pct = Math.min(100, (weight / cap) * 100);
      $('#o-load').style.width = pct + '%';
      $('#o-load').className = weight > cap ? 'over' : pct > 85 ? 'near' : '';
      $('#o-load-t').textContent = `${weight} of ${ids.length * LF.CARRY} lb carried`;
      const party = ids.map(LF.crewById);
      const has = (k, n) => party.some((m) => m[k] >= (n || 2));
      const warn = [];
      if (!has('survey')) warn.push('No trained surveyor. The chart will be rough and distances will drift.');
      else if (!gear.compass) warn.push('No compass and chain. The surveyor will lose track of distance more often.');
      if (!has('tongue')) warn.push('No translator for a first meeting.');
      if (!has('forage')) warn.push('No hunter. The party lives only on what it carries.');
      if (!gear.powder) warn.push('No powder. Muskets are useless for hunting or defense.');
      if (!gear.tent) warn.push('No tent. Storms will spoil food and spirits.');
      let msg;
      if (ids.length < 2) msg = 'Pick at least two people.';
      else if (ids.length > 5) msg = 'Five at most. A bigger party eats too fast and moves too slowly.';
      else if (rations > g.stores.rations) msg = `That is ${rations} rations, and the landing has only ${Math.floor(g.stores.rations)}.`;
      else if (weight > cap) msg = `Too heavy. Leave something behind or take another pair of hands.`;
      else msg = `${Num(ids.length)} people with ${rations} rations. That is ${days} days of food, so about ${Math.floor(days / 2)} days out before turning back.`;
      $('#o-sum').innerHTML = esc(msg) + (warn.length && ids.length >= 2 ? `<span class="warns">${warn.map(esc).join('<br>')}</span>` : '');
      $('#o-go').disabled = !valid(ids);
    };
    document.querySelectorAll('#modal input').forEach((i) => (i.oninput = upd));
    document.querySelectorAll('#modal .gear-row').forEach((row) => {
      row.querySelectorAll('button').forEach((b) => (b.onclick = () => {
        const k = row.dataset.k;
        const max = LF.GEAR[k].single ? Math.min(1, g.stores[k]) : Math.floor(g.stores[k]);
        gear[k] = clamp(gear[k] + +b.dataset.d, 0, max);
        upd();
      }));
    });
    upd();
  };

  function launch(ids, gear, pace) {
    const g = G();
    for (const k of LF.GEAR_ORDER) g.stores[k] -= gear[k];
    g.expeditions++;
    for (const id of ids) LF.crewById(id).away = true;
    g.party = {
      members: ids,
      gear,
      pace,
      x: g.world.camp.x,
      y: g.world.camp.y,
      hour: 7,
      drift: { x: 0, y: 0 },
      notes: LF.newKnowledge(),
      stakes: [],
      seen: new Set(),
      todaySeen: new Map(),
      visited: new Set(),
      avoided: new Set(),
      crossed: new Set(),
      found: new Set(),
      startDay: g.day,
      log: [],
      rng: LF.rng(g.seed * 31 + g.expeditions * 977),
      morale: 70,
      canoeOn: false,
      nightMarch: false,
      halfNights: 0,
      guide: null,
      lastEvent: -99,
      steps: 0,
      weather: null,
      peaks: new Set(),
    };
    g.party.alive = alive();
    g.mode = 'field';
    g.showMap = false;
    plog(`Set out from the landing: ${listJoin(g.party.alive.map(first))}. ${LF.PACES[pace].name} pace.`);
    look();
    LF.render();
  }

  // ---------------------------------------------------------------- seeing

  function look() {
    const p = G().party, w = G().world;
    const r = sightRadius();
    const surveyor = bestAt('survey');
    let err = LF.PACES[p.pace].err;
    if (p.pace === 'forced' && surveyor && LF.hasTrait(surveyor, 'methodical')) err *= 1.4;
    if (surveyor && LF.hasTrait(surveyor, 'methodical')) err *= 0.8;
    if (p.gear.compass) err *= 0.85;
    if (p.hour >= DUSK) err *= 2.2;
    const o = { skill: skill('survey'), sight: r, dx: p.drift.x, dy: p.drift.y, day: G().day, rng: p.rng, hunter: skill('forage') >= 2, errMul: err };
    LF.around(p.x, p.y, r, (x, y, d, i) => {
      LF.observe(p.notes, x, y, d, o);
      p.seen.add(i);
      const prev = p.todaySeen.get(i);
      if (prev === undefined || d < prev) p.todaySeen.set(i, d);
      const f = w.feat[i];
      if (f && d <= 2.3 && !p.found.has(i) && (f !== F.BURIAL || d <= 1.5)) {
        p.found.add(i);
        plog(`Found: ${LF.F_INFO[f].name.toLowerCase()}. ${LF.F_INFO[f].note}`);
        LF.toast(`Found: ${LF.F_INFO[f].name}`);
      }
    });
    for (const v of w.villages) {
      const d = Math.hypot(v.x - p.x, v.y - p.y);
      if (d > r + 0.01) continue;
      v.pencil = { x: clamp(v.x + p.drift.x, 0, W - 1), y: clamp(v.y + p.drift.y, 0, H - 1) };
      if (!v.contacted && !p.avoided.has(v.id)) {
        stopWalk();
        contact(v, 'town');
        return true;
      }
      if (v.contacted && d <= 1.5 && !p.visited.has(v.id)) {
        p.visited.add(v.id);
        stopWalk();
        visit(v);
        return true;
      }
    }
    const f = w.feat[idx(p.x, p.y)];
    if (f === F.WRECK && !G().flags.wreck) { stopWalk(); wreckEvent(); return true; }
    if (f === F.RUIN && !G().flags.ruin) { stopWalk(); ruinEvent(); return true; }
    if (f === F.BURIAL && !p.crossed.has('b' + idx(p.x, p.y))) { p.crossed.add('b' + idx(p.x, p.y)); stopWalk(); burialEvent(); return true; }
    if (LF.isHigh(here()) && !p.peaks.has(idx(p.x, p.y)) && here() === T.MOUNTAIN) { p.peaks.add(idx(p.x, p.y)); summit(); }
    return false;
  }

  // ---------------------------------------------------------------- moving

  function waterMove(k) {
    return (k === T.SEA || k === T.LAKE) && G().party.gear.canoe;
  }

  function stepCost(nx, ny, fx, fy, forPath) {
    const g = G(), p = g.party, w = g.world;
    const i = idx(nx, ny), fi = idx(fx, fy);
    const k = w.t[i];
    if (k === T.DEEP) return Infinity;
    const onWaterNow = LF.isWater(w.t[fi]) || (p.canoeOn && w.river[fi]);
    const paddle = p.gear.canoe && (LF.isWater(k) || (w.river[i] && (w.river[fi] || LF.isWater(w.t[fi]))) && w.feat[i] !== F.FALLS);
    if (LF.isWater(k) && !waterMove(k)) return Infinity;
    const waterman = anyTrait('waterman');
    let c;
    if (paddle && (LF.isWater(k) || onWaterNow || w.river[fi])) c = waterman ? 0.35 : 0.5;
    else {
      c = LF.T_COST[k];
      if (LF.isWoods(k) && anyTrait('woodsman')) c *= 0.75;
      if (w.river[i] && !w.river[fi] && w.feat[i] !== F.FORD) c += 1;
      if (p.gear.canoe) c += waterman ? 0.25 : 0.5;
    }
    c *= LF.PACES[p.pace].time;
    c *= 1 + avgFatigue() / 160;
    if (p.morale < 30) c *= 1.2;
    if (!forPath && p.hour >= DUSK) c *= 1.5;
    return Math.round(c * 4) / 4;
  }

  function tryStep(dx, dy, force) {
    const g = G();
    if (LF.modalOpen() || !g.party) return false;
    const p = g.party, w = g.world;
    const nx = p.x + dx, ny = p.y + dy;
    if (!inb(nx, ny)) return false;
    const k = w.t[idx(nx, ny)];
    const cost = stepCost(nx, ny, p.x, p.y);
    if (!isFinite(cost)) {
      LF.toast(LF.isWater(k) ? (p.gear.canoe && k !== T.DEEP ? 'Too deep and rough for a canoe.' : 'Open water. The party needs a canoe.') : 'The way is blocked.');
      return false;
    }
    // Fording a river that is running high.
    const ni = idx(nx, ny);
    if (!force && w.river[ni] && !w.river[idx(p.x, p.y)] && w.feat[ni] !== F.FORD && !p.canoeOn && !p.crossed.has(ni) && !p.gear.canoe) {
      p.crossed.add(ni);
      if (R() < 0.28) { stopWalk(); floodEvent(dx, dy); return false; }
    }
    p.x = nx;
    p.y = ny;
    p.steps++;
    p.canoeOn = !!p.gear.canoe && (LF.isWater(k) || (w.river[ni] && (p.canoeOn || LF.isWater(w.t[idx(nx - dx, ny - dy)]))));
    const before = p.hour;
    p.hour += cost;
    const pf = LF.PACES[p.pace].fatigue;
    for (const m of alive()) m.fatigue = Math.min(100, m.fatigue + cost * (p.canoeOn ? 1.5 : 3.2) * pf * (LF.hasTrait(m, 'greenhand') ? 1.3 : 1));

    if (nx === w.camp.x && ny === w.camp.y) {
      stopWalk();
      returnToCamp();
      return false;
    }

    // Stumbles and falls.
    const risky = here() === T.MOUNTAIN || here() === T.SWAMP || here() === T.HILLS || p.hour >= DUSK;
    if (risky) {
      let chance = (p.hour >= DUSK ? 0.07 : 0.015) * LF.PACES[p.pace].risk;
      if (p.hour >= DUSK && anyTrait('nightowl')) chance *= 0.4;
      if (anyTrait('clumsy')) chance *= 1.6;
      if (R() < chance) {
        const v = withTrait('clumsy') || LF.pick(alive(), R);
        if (p.hour >= DUSK && R() < 0.5 && skill('survey') < 3) {
          nudgeDrift();
          plog('Stumbling in the dark, the party lost its bearings.');
        } else {
          v.health--;
          plog(`${first(v)} fell and was hurt.`);
          LF.toast(`${first(v)} fell and was hurt.`);
        }
      }
    }
    checkDeaths();
    if (!G().party) return false;
    p.alive = alive();

    if (look()) { LF.render(); return false; }

    if (before < DUSK && p.hour >= DUSK) {
      stopWalk();
      LF.render();
      dusk();
      return false;
    }
    if (p.hour >= LAST_HOUR) {
      stopWalk();
      LF.render();
      LF.queueModal({ title: 'Too dark to go on', body: '<p>The party can go no farther tonight. They stop where they stand.</p>', buttons: [{ label: 'Make camp', primary: true, act: () => openCamp() }] });
      return false;
    }
    if (dayEvent()) { LF.render(); return false; }
    LF.render();
    return true;
  }

  function nudgeDrift() {
    const p = G().party;
    const d = LF.N4[Math.floor(R() * 4)];
    p.drift.x = clamp(p.drift.x + d[0], -3, 3);
    p.drift.y = clamp(p.drift.y + d[1], -3, 3);
  }

  function dusk() {
    const p = G().party;
    p.weather = rollWeather();
    const wx = WEATHER[p.weather];
    LF.queueModal({
      title: 'Dusk',
      eyebrow: `${clockText(p.hour)}, ${LF.dateOf(G().day).name}`,
      body: `<p>The light is going. ${wx.sky} Here the ground is ${LF.T_SHORT[here()]}.</p><p class="muted">Marching after dark is slow, the party sees little, and the notes will be poor. People get hurt.</p>`,
      buttons: [
        { label: 'Make camp here', primary: true, act: () => openCamp() },
        { label: 'Press on in the dark', act: () => { p.nightMarch = true; plog('Pressed on after dark.'); } },
      ],
    });
  }

  // ---------------------------------------------------------------- nights

  const WEATHER = {
    clear: { name: 'Clear', sky: 'The sky is clear.' },
    cold: { name: 'Cold', sky: 'It will be a cold night.' },
    rain: { name: 'Rain', sky: 'Clouds are coming in from the west, heavy with rain.' },
    storm: { name: 'Storm', sky: 'The wind is rising. A storm is coming.' },
  };
  function rollWeather() {
    const r = R();
    return r < 0.55 ? 'clear' : r < 0.7 ? 'cold' : r < 0.9 ? 'rain' : 'storm';
  }

  const TASKS = {
    rest: { name: 'Rest', ok: () => true },
    watch: { name: 'Keep watch', ok: () => true },
    hunt: { name: 'Hunt', ok: (m) => m.forage >= 1 },
    fish: { name: 'Fish', ok: () => nearWater() },
    forage: { name: 'Gather food', ok: () => LF.isLand(here()) },
    sketch: { name: 'Redraw today’s notes', ok: (m) => m.survey >= 1 },
    tend: { name: 'Tend the sick', ok: (m) => m.heal >= 1 },
    pray: { name: 'Lead prayers', ok: (m) => LF.hasTrait(m, 'devout') },
  };

  function nearWater() {
    const p = G().party, w = G().world;
    let hit = false;
    LF.around(p.x, p.y, 1.5, (x, y, d, i) => { if (w.river[i] || LF.isWater(w.t[i])) hit = true; });
    return hit;
  }
  function near(pred, r) {
    const p = G().party;
    let n = 0;
    LF.around(p.x, p.y, r, (x, y, d, i) => { if (pred(i)) n++; });
    return n;
  }

  function defaultTask(m) {
    const hurt = alive().some((x) => x.health < 3);
    if (m.survey >= 2) return 'sketch';
    if (m.forage >= 2) return 'hunt';
    if (m.heal >= 1 && hurt) return 'tend';
    if (m.guard >= 2) return 'watch';
    return 'rest';
  }

  function openCamp() {
    const g = G(), p = g.party;
    if (!p) return;
    if (!p.weather) p.weather = rollWeather();
    const wx = WEATHER[p.weather];
    const wet = near((i) => LF.isWet(g.world.t[i]), 1.5);
    const conds = [];
    conds.push(`<li><strong>Weather:</strong> ${wx.name}. ${p.weather === 'storm' || p.weather === 'rain' ? (p.gear.tent ? 'The tent will keep most of it off.' : 'No tent. Everyone will be soaked.') : p.weather === 'cold' ? 'A cold camp would be miserable tonight.' : ''}</li>`);
    if (wet) conds.push('<li><strong>Low, wet ground.</strong> Marsh air brings fevers.</li>');
    if (nearWater()) conds.push('<li><strong>Water close by.</strong> Someone could fish.</li>');
    if (near((i) => g.world.game[i], 1.5)) conds.push('<li><strong>Game sign all around.</strong> Good hunting.</li>');
    const hostile = g.world.villages.find((v) => v.relation < 0 && Math.hypot(v.x - p.x, v.y - p.y) < 12);
    if (hostile) conds.push(`<li><strong>Close to ${esc(hostile.name)}.</strong> They are not friendly. A big fire will be seen.</li>`);
    if (LF.isHigh(here())) conds.push('<li><strong>High, open ground.</strong> A fire here can be seen for miles.</li>');
    const rows = alive().map((m) => {
      const opts = Object.entries(TASKS).filter(([, t]) => t.ok(m)).map(([k, t]) => `<option value="${k}" ${defaultTask(m) === k ? 'selected' : ''}>${t.name}</option>`).join('');
      return `<div class="task-row"><div><strong>${esc(m.name)}</strong> <span class="role">${esc(m.role)}</span><div class="sub">${LF.pips(m.health, 3, 'hp')} <span class="fat">${m.fatigue > 70 ? 'Exhausted' : m.fatigue > 40 ? 'Tired' : 'Fresh'}</span></div></div>
        <select id="task-${m.id}" aria-label="Task for ${esc(m.name)}">${opts}</select></div>`;
    }).join('');
    const needFull = alive().reduce((s, m) => s + (LF.hasTrait(m, 'glutton') ? 1.5 : 1), 0);
    LF.showModal({
      title: `Night camp`,
      eyebrow: `${LF.dateOf(g.day).name}. ${LF.cap(LF.T_SHORT[here()])}, ${LF.miles(Math.hypot(g.world.camp.x - p.x, g.world.camp.y - p.y))} from the landing`,
      wide: true,
      kind: 'camp',
      locked: true,
      body: `
        <ul class="conds">${conds.join('')}</ul>
        <div class="camp-grid">
          <section><h3 class="mh">The fire</h3><div class="radios">
            <label class="radio"><input type="radio" name="fire" value="big" id="fire-big" ${hostile ? '' : 'checked'}><span><strong>A big fire</strong><em>Warmth and cheer. Keeps animals off. Can be seen from far away.</em></span></label>
            <label class="radio"><input type="radio" name="fire" value="small" id="fire-small" ${hostile ? 'checked' : ''}><span><strong>A small fire</strong><em>Enough to cook on.</em></span></label>
            <label class="radio"><input type="radio" name="fire" value="cold" id="fire-cold"><span><strong>A cold camp</strong><em>Nobody will see you. Nobody will be happy.</em></span></label>
          </div></section>
          <section><h3 class="mh">Supper</h3><div class="radios">
            <label class="radio"><input type="radio" name="ration" value="full" id="ration-full" checked><span><strong>Full rations</strong><em>${needFull} rations tonight. ${Math.floor(p.gear.rations)} left.</em></span></label>
            <label class="radio"><input type="radio" name="ration" value="half" id="ration-half"><span><strong>Half rations</strong><em>Stretches the food. Hurts spirits, and health after a few nights.</em></span></label>
          </div></section>
        </div>
        <section><h3 class="mh">Through the night</h3><div class="tasks">${rows}</div></section>`,
      buttons: [{ label: 'Bed down for the night', primary: true, keep: true, act: () => {
        const plan = { fire: document.querySelector('input[name=fire]:checked').value, ration: document.querySelector('input[name=ration]:checked').value, tasks: {} };
        for (const m of alive()) plan.tasks[m.id] = $('#task-' + m.id).value;
        LF.closeModal();
        resolveNight(plan);
      } }],
    });
    p.camping = true;
    LF.render();
  }
  LF.openCamp = openCamp;

  function resolveNight(plan) {
    const g = G(), p = g.party, w = g.world;
    if (!p) return;
    const lines = [];
    const followups = [];
    const crew = alive();
    const byTask = (t) => crew.filter((m) => plan.tasks[m.id] === t);
    const weather = p.weather || 'clear';
    const tent = p.gear.tent > 0;
    const k = here();
    let morale = 0;

    LF.campDay();

    // Food.
    const need = crew.reduce((s, m) => s + (LF.hasTrait(m, 'glutton') ? 1.5 : 1), 0) * (plan.ration === 'half' ? 0.5 : 1);
    if (p.gear.rations >= need) {
      p.gear.rations -= need;
      if (plan.ration === 'half') { p.halfNights++; morale -= 6; } else p.halfNights = Math.max(0, p.halfNights - 1);
    } else {
      p.gear.rations = 0;
      p.halfNights += 2;
      morale -= 12;
      lines.push('The food ran out. Everyone went to sleep hungry.');
    }
    if (p.halfNights >= 3) {
      for (const m of crew) if (!(LF.hasTrait(m, 'hardy') && R() < 0.5)) m.health--;
      lines.push('Days of short rations are telling. Everyone is weaker.');
      p.halfNights = 1;
    }

    // Hunting, fishing, gathering.
    let got = 0;
    for (const m of byTask('hunt')) {
      let chance = 0.2 + 0.17 * m.forage + (LF.isWoods(k) ? 0.1 : 0) + (near((i) => w.game[i], 1.5) ? 0.15 : 0) + (near((i) => w.feat[i] === F.SALTLICK, 4) ? 0.15 : 0);
      const shoot = p.gear.powder > 0;
      if (shoot) chance += 0.15;
      if (plan.fire === 'big') chance -= 0.05;
      if (R() < chance) {
        const n = Math.round(2 + m.forage * 1.5 + R() * 3);
        if (shoot && R() < 0.6) p.gear.powder--;
        got += n;
        lines.push(`${first(m)} ${shoot ? 'shot a deer' : 'snared rabbits'} at dusk. +${n} rations.`);
        morale += 4;
      } else lines.push(`${first(m)} hunted until dark and came back empty-handed.`);
    }
    for (const m of byTask('fish')) {
      if (R() < 0.55 + (LF.hasTrait(m, 'waterman') ? 0.2 : 0)) {
        const n = 2 + Math.floor(R() * 4);
        got += n;
        lines.push(`${first(m)} caught fish. +${n} rations.`);
      } else lines.push(`${first(m)} fished without luck.`);
    }
    for (const m of byTask('forage')) {
      const berries = near((i) => w.feat[i] === F.BERRIES, 2.5) && LF.season(g.day) === 'summer';
      if (R() < 0.35 + (berries ? 0.4 : 0) + (LF.isOpen(k) ? 0.1 : 0)) {
        const n = 1 + Math.floor(R() * (berries ? 5 : 3));
        got += n;
        lines.push(`${first(m)} gathered ${berries ? 'berries' : 'greens and nuts'}. +${n} rations.`);
      }
    }
    p.gear.rations += got;

    // Redrawing the day's notes by the fire.
    const sketchers = byTask('sketch');
    if (sketchers.length) {
      const s = sketchers.reduce((b, m) => (m.survey > b.survey ? m : b));
      const mult = LF.hasTrait(s, 'quickhand') ? 0.35 : 0.6;
      const o = { skill: Math.max(1, s.survey), sight: 5, dx: p.drift.x, dy: p.drift.y, day: g.day - 1, rng: p.rng, hunter: skill('forage') >= 2, errMul: mult };
      let fixed = 0;
      for (const [i, d] of p.todaySeen) {
        const x = i % W, y = (i / W) | 0;
        const before = p.notes.q[idx(clamp(x + p.drift.x, 0, W - 1), clamp(y + p.drift.y, 0, H - 1))];
        LF.observe(p.notes, x, y, d, o);
        if (p.notes.q[idx(clamp(x + p.drift.x, 0, W - 1), clamp(y + p.drift.y, 0, H - 1))] > before) fixed++;
      }
      lines.push(`${first(s)} worked over the day’s notes by the fire${fixed ? ` and redrew ${fixed} uncertain squares` : ''}.`);
      if (p.gear.compass && s.survey >= 2 && (p.drift.x || p.drift.y) && weather === 'clear' && R() < 0.7) {
        p.drift.x -= Math.sign(p.drift.x);
        p.drift.y -= Math.sign(p.drift.y);
        lines.push(`The sky was clear. ${first(s)} took a star sight and corrected the party’s reckoning.`);
      }
    }
    p.todaySeen.clear();

    // Weather and the fire.
    if (plan.fire === 'big') morale += 6;
    else if (plan.fire === 'cold') morale -= 6;
    if (weather === 'rain' && !tent) { morale -= 6; lines.push('Rain all night. Nobody slept dry.'); }
    if (weather === 'storm') {
      if (tent) lines.push('A storm blew through. The tent held.');
      else {
        const lost = Math.ceil(p.gear.rations * 0.2);
        p.gear.rations -= lost;
        if (p.gear.powder > 0) p.gear.powder--;
        morale -= 12;
        lines.push(`A storm tore through the camp. ${lost ? `${lost} rations spoiled` : 'Everything got soaked'}${p.gear.powder >= 0 ? ' and some of the powder got wet' : ''}.`);
      }
    }
    if (weather === 'cold' && plan.fire === 'cold') {
      const v = LF.pick(crew, R);
      if (!LF.hasTrait(v, 'hardy')) { v.health--; lines.push(`It was bitterly cold without a fire. ${first(v)} took a chill.`); }
    }

    // Fever from marsh air.
    const marsh = near((i) => LF.isWet(w.t[i]), 1.5);
    if (marsh >= 2 && R() < 0.3 + (LF.season(g.day) === 'summer' ? 0.1 : 0)) {
      const v = LF.pick(crew, R);
      const tender = byTask('tend')[0];
      if (tender && (p.gear.medicine > 0 || tender.heal >= 3)) {
        if (p.gear.medicine > 0) p.gear.medicine--;
        lines.push(`${first(v)} took a fever from the marsh air. ${first(tender)} dosed it and it broke by morning.`);
      } else if (LF.hasTrait(v, 'hardy') && R() < 0.5) lines.push(`${first(v)} shivered with marsh fever but threw it off.`);
      else { v.health--; lines.push(`${first(v)} woke shaking with marsh fever.`); morale -= 4; }
    }

    // Something in the dark.
    const watchers = byTask('watch');
    let threat = 0.1 + (plan.fire === 'cold' ? -0.04 : 0) + (plan.fire === 'big' ? -0.03 : 0);
    if (LF.isWoods(k) || LF.isHigh(k)) threat += 0.05;
    const hostile = w.villages.find((v) => v.relation < 0 && Math.hypot(v.x - p.x, v.y - p.y) < 12);
    if (hostile && plan.fire === 'big') threat += 0.15;
    if (R() < threat) {
      const roll = R();
      if (hostile && roll < 0.5) {
        if (watchers.length) {
          lines.push(`Shapes moved at the edge of the firelight. ${first(watchers[0])} called out and they melted away. Probably men from ${hostile.name}.`);
          morale -= 5;
        } else {
          const lostTools = Math.min(p.gear.tools, 1), lostR = Math.ceil(p.gear.rations / 3);
          p.gear.tools -= lostTools;
          p.gear.rations -= lostR;
          lines.push(`Someone came into camp while everyone slept. In the morning ${lostR} rations${lostTools ? ' and a bundle of tools' : ''} were gone.`);
          morale -= 10;
        }
      } else if (roll < 0.75) {
        if (watchers.length && p.gear.powder > 0) {
          p.gear.powder--;
          p.gear.rations += 6;
          lines.push(`A bear came for the food. ${first(watchers[0])} shot it. Bear meat for days. +6 rations.`);
          morale += 5;
        } else if (watchers.length || plan.fire === 'big') lines.push('A bear came sniffing at the edge of camp and was driven off.');
        else {
          const v = LF.pick(crew, R);
          v.health--;
          lines.push(`A bear came into camp. ${first(v)} was mauled before it ran off.`);
          morale -= 10;
        }
      } else {
        if (watchers.length) lines.push('Wolves howled close by all night. The watch kept them off the food.');
        else {
          const lost = Math.ceil(p.gear.rations * 0.25);
          p.gear.rations -= lost;
          lines.push(`Wolves got into the packs. ${lost} rations gone.`);
          morale -= 6;
        }
      }
    }

    // Prayer, rest and healing.
    for (const m of byTask('pray')) { morale += 8; lines.push(`${first(m)} led prayers by the fire.`); }
    for (const m of crew) {
      const task = plan.tasks[m.id];
      const restful = task === 'rest' || task === 'pray';
      const recover = (restful ? 70 : 35) * (weather === 'rain' && !tent ? 0.5 : 1) * (weather === 'storm' && !tent ? 0.4 : 1);
      m.fatigue = Math.max(0, m.fatigue - recover);
      if (restful && m.health > 0 && m.health < 3 && R() < 0.2 + (tent ? 0.1 : 0)) m.health++;
    }
    for (const t of byTask('tend')) {
      const sick = crew.filter((m) => m.health > 0 && m.health < 3).sort((a, b) => a.health - b.health)[0];
      if (!sick) continue;
      if (p.gear.medicine > 0 || R() < 0.5) {
        if (p.gear.medicine > 0) p.gear.medicine--;
        sick.health++;
        lines.push(sick === t ? `${first(t)} dressed their own wounds.` : `${first(t)} tended ${first(sick)}.`);
      }
    }

    // Morale drifts back toward a middling mood.
    morale += (60 - p.morale) * 0.1;
    if (anyTrait('steady')) morale = Math.max(morale, 35 - p.morale);
    p.morale = clamp(p.morale + morale, 0, 100);

    // Drift without a surveyor or compass.
    const sk = skill('survey');
    let dChance = [0.55, 0.25, 0.08, 0.02][sk] * (p.gear.compass ? 0.35 : 1);
    if (p.guide !== null) dChance = 0;
    if (R() < dChance) {
      nudgeDrift();
      if (sk === 0) lines.push('Nobody can say for sure how far the party walked today.');
    }

    // Desertion.
    if (p.morale < 25) {
      const h = crew.find((m) => LF.hasTrait(m, 'homesick') && m.health > 0);
      if (h && R() < 0.5) {
        p.members = p.members.filter((id) => id !== h.id);
        const d = Math.hypot(w.camp.x - p.x, w.camp.y - p.y);
        h.away = false;
        if (d > 24 && R() < 0.35) {
          h.alive = false;
          LF.journal(`${h.name} deserted a survey party and was never seen again.`);
          lines.push(`In the morning ${h.name} was gone, and so was a share of the food. Nobody expects to see ${first(h)} again.`);
        } else {
          LF.journal(`${h.name} deserted a survey party and walked back to the landing alone.`);
          lines.push(`In the morning ${h.name} was gone, headed back alone for the landing.`);
        }
        p.gear.rations = Math.max(0, p.gear.rations - 3);
      }
    }

    const deaths = checkDeaths();
    if (!G().party) return;
    p.hour = 6 + (weather === 'storm' && !tent ? 3 : 0);
    p.nightMarch = false;
    p.camping = false;
    p.weather = null;
    p.alive = alive();
    for (const l of lines) plog(l);
    const mood = p.morale >= 70 ? 'The party is in good heart.' : p.morale >= 45 ? 'Spirits are fair.' : p.morale >= 25 ? 'Spirits are low.' : 'The party is close to breaking.';
    LF.queueModal({
      title: 'Morning',
      eyebrow: LF.dateOf(g.day).name,
      body: `<ul class="night">${lines.map((l) => `<li>${esc(l)}</li>`).join('') || '<li>A quiet night.</li>'}</ul>${deaths.map((d) => `<p class="death">${d}</p>`).join('')}<p class="muted">${mood} ${Math.floor(p.gear.rations)} rations left.${g.day === LF.DEADLINE + 1 ? ' <strong>The 9th of June has passed. Every day now costs the settlers aboard.</strong>' : ''}</p>`,
      buttons: [{ label: 'Break camp', primary: true }],
    });
    for (const f of followups) LF.queueModal(f);
  }

  function checkDeaths() {
    const out = [];
    const g = G();
    for (const m of members()) {
      if (m.alive && m.health <= 0) {
        m.alive = false;
        m.away = false;
        m.diedDay = g.day;
        plog(`${m.name} died.`);
        out.push(`<strong>${esc(m.name)}</strong>, ${esc(m.role.toLowerCase())}, has died.`);
        LF.journal(`${m.name} died in the field.`);
        if (g.party) g.party.morale = Math.max(0, g.party.morale - 20);
      }
    }
    if (g.party && !alive().length) {
      partyLost();
      return [];
    }
    if (out.length && !g.party.camping) LF.queueModal({ title: 'A death in the party', body: out.map((o) => `<p>${o}</p>`).join('') });
    return out;
  }

  function partyLost() {
    const g = G(), p = g.party;
    const names = p.members.map((id) => LF.crewById(id).name);
    for (const v of g.world.villages) v.pencil = null;
    LF.journal(`The party of ${listJoin(names)} never came back. Their notes and survey stakes are lost with them.`);
    g.party = null;
    g.mode = 'camp';
    stopWalk();
    LF.queueModal({
      title: 'The party is lost',
      body: `<p>No one from the party of ${esc(listJoin(names))} made it back to the landing. Whatever they drew in their notebooks is gone, along with any stakes they planted and the gear they carried.</p>`,
      buttons: [{ label: 'Return to the map table', primary: true }],
    });
    LF.render();
  }

  function returnToCamp() {
    const g = G(), p = g.party;
    const back = alive();
    const dead = members().filter((m) => !m.alive);
    const { added, revised } = LF.commitNotes(p.notes);
    for (const st of p.stakes) g.sites.push({ ...st });
    for (const v of g.world.villages)
      if (v.pencil) {
        v.drawn = v.pencil;
        v.pencil = null;
      }
    for (const k of LF.GEAR_ORDER) g.stores[k] += p.gear[k];
    for (const m of back) { m.away = false; }
    const days = g.day - p.startDay;
    const acres = (added * LF.ACRES_PER_TILE).toLocaleString('en-US');
    const text = `The party returned after ${LF.plural(days, 'day')}. About ${acres} acres added to the chart${revised ? `, ${revised} squares redrawn` : ''}.${p.stakes.length ? ` Stakes planted: ${p.stakes.map((s) => s.name).join(', ')}.` : ''}${dead.length ? ` Lost: ${listJoin(dead.map((d) => d.name))}.` : ''}`;
    LF.journal(text);
    const drifted = p.drift.x || p.drift.y;
    const done = LF.checkMissions();
    g.party = null;
    g.mode = 'camp';
    LF.render();
    LF.queueModal({
      title: 'Back at the landing',
      eyebrow: LF.dateOf(g.day).name,
      body: `<p>${esc(text)}</p><p class="muted">${drifted ? 'The field notes have been inked onto the chart. The surveyor looked uneasy about the distances.' : 'The field notes have been inked onto the chart.'}</p>${done.map((k) => `<p class="ok-line"><strong>${esc(LF.ADVISORS[k].name)}</strong> is pleased: ${esc(LF.MISSIONS[k].text.split('.')[0].toLowerCase())}. Done.</p>`).join('')}`,
      buttons: [{ label: 'To the map table', primary: true }],
    });
  }

  // ---------------------------------------------------------------- stakes

  function nameFor(x, y) {
    const w = G().world, i = idx(x, y);
    const who = bestAt('survey');
    const S = last(who && who.survey > 0 ? who : alive()[0]);
    const nearRiver = near((j) => w.river[j], 1.5) > 0;
    const k = w.t[i];
    const f = w.feat[i];
    let name;
    if (f === F.CLIFF) name = `${S}’s Bluff`;
    else if (f === F.RUIN) name = 'the Empty Town';
    else if (nearRiver && w.seaDist[i] <= 2) name = `${S}’s River Mouth`;
    else if (w.seaDist[i] <= 1) name = `${S}’s Point`;
    else if (near((j) => w.t[j] === T.LAKE, 2) && !nearRiver) name = `${S}’s Pond`;
    else if (LF.isHigh(k)) name = `${S}’s Rise`;
    else if (nearRiver) name = `${S}’s Ford`;
    else if (LF.isWet(k)) name = `${S}’s Bottoms`;
    else if (k === T.OLDFIELD) name = `${S}’s Old Fields`;
    else if (LF.isWoods(k)) name = `${S}’s Wood`;
    else name = `${S}’s Meadow`;
    const taken = new Set([...G().sites, ...G().party.stakes].map((s) => s.name));
    if (taken.has(name)) {
      let n = 2;
      while (taken.has(`${name} ${n}`)) n++;
      name = `${name} ${n}`;
    }
    return name.charAt(0).toUpperCase() + name.slice(1);
  }

  function plantStake() {
    const g = G(), p = g.party;
    if (!p || LF.modalOpen()) return;
    const count = g.sites.filter((s) => !s.isLanding).length + p.stakes.length;
    if (count >= 5) return LF.toast('The council will weigh five sites at most.');
    if (!LF.isLand(here())) return LF.toast('Put the canoe ashore first.');
    if (p.stakes.some((s) => s.tx === p.x && s.ty === p.y)) return LF.toast('There is already a stake here.');
    if (Math.hypot(p.x - g.world.camp.x, p.y - g.world.camp.y) < 5) return LF.toast('Too close to the landing to count as a separate site.');
    if ([...g.sites, ...p.stakes].some((s) => Math.hypot(s.tx - p.x, s.ty - p.y) < 4)) return LF.toast('Too close to another stake.');
    const used = new Set([...g.sites, ...p.stakes].map((s) => s.letter));
    const letter = 'ABCDEFGH'.split('').find((l) => !used.has(l));
    const who = bestAt('survey');
    const st = { letter, name: nameFor(p.x, p.y), x: clamp(p.x + p.drift.x, 0, W - 1), y: clamp(p.y + p.drift.y, 0, H - 1), tx: p.x, ty: p.y, day: g.day, by: who && who.survey > 0 ? who.name : alive()[0].name, byId: who && who.survey > 0 ? who.id : null, surveyed: skill('survey'), compass: !!p.gear.compass };
    p.stakes.push(st);
    p.hour += 0.5;
    plog(`Planted a survey stake: ${st.name} (Site ${letter}). It counts once the party is back at the landing.`);
    LF.render();
  }

  // ---------------------------------------------------------------- towns

  function contact(v, how) {
    const g = G(), p = g.party;
    const tongue = skill('tongue'), guard = skill('guard');
    const translator = bestAt('tongue');
    const riverSide = near((i) => g.world.river[i], 1.5) > 0;
    const speak =
      tongue >= 2
        ? `${esc(translator.name)} recognizes their speech as a cousin of the coast languages and thinks the party can be understood.`
        : tongue === 1
        ? `${esc(first(translator))} knows a handful of trade words. It will not go far.`
        : 'Nobody in the party speaks a word of their language.';
    const intro = how === 'hunters'
      ? '<p>A dozen men step out of the trees ahead, bows in hand. A hunting party. They were watching you long before you saw them.</p>'
      : `<p>Past the next rise the party finds fields of corn, beans and squash, and beyond them a town of bark-covered houses ${riverSide ? 'on the riverbank' : 'in a wide clearing'}. Children have seen you and run back toward the houses. Men are coming out to look.</p>`;
    const rivalNote = v.rival !== null && g.world.villages[v.rival] && g.world.villages[v.rival].relation >= 1 && g.world.villages[v.rival].contacted
      ? `<p class="muted">They may already know you have been friendly with ${esc(g.world.villages[v.rival].name)}.</p>` : '';
    const buttons = [{ label: 'Walk up openly, hands empty', primary: true, act: () => resolveContact(v, 'open') }];
    const giftOpts = [['tools', 'iron tools'], ['cloth', 'woolen cloth'], ['beads', 'glass beads']].filter(([k]) => p.gear[k] > 0);
    for (const [k, l] of giftOpts) buttons.push({ label: `Lead with gifts of ${l}`, act: () => resolveContact(v, 'gift', k) });
    if (guard > 0) buttons.push({ label: 'Approach under arms', act: () => resolveContact(v, 'arms') });
    buttons.push({ label: 'Keep your distance and move on', act: () => resolveContact(v, 'avoid') });
    LF.queueModal({ title: how === 'hunters' ? 'Hunters' : 'Smoke above the trees', eyebrow: 'First contact', body: intro + `<p>${speak}</p>` + rivalNote, buttons, locked: true });
  }
  LF.contactVillage = contact;

  function resolveContact(v, how, giftKind) {
    const g = G(), p = g.party;
    const tongue = skill('tongue');
    const translator = bestAt('tongue');
    let body = '';
    if (how === 'avoid') {
      p.avoided.add(v.id);
      v.memory.push('They saw strangers pass by and keep away.');
      plog('Saw a town and kept away from it. They certainly saw us.');
      return;
    }
    v.contacted = true;
    const patient = translator && LF.hasTrait(translator, 'patient') && tongue >= 2;
    const rival = v.rival !== null ? g.world.villages[v.rival] : null;
    let rel = 0;
    if (how === 'open') {
      rel = tongue >= 2 ? 1 : 0;
      body = tongue >= 2
        ? `<p>${esc(first(translator))} does the talking. It is slow going, but by evening the party is sitting at a fire inside the town, eating roasted corn. They call themselves <strong>${esc(v.name)}</strong>, in ${esc(first(translator))}’s rendering.</p>`
        : `<p>The meeting is all gestures. Both sides are polite and neither understands much. The party is given water and watched until it leaves. You learn only that this is the town of <strong>${esc(v.name)}</strong>, or something like it.</p>`;
      v.memory.push('Strangers came openly, with empty hands.');
    } else if (how === 'gift') {
      const n = Math.min(giftKind === 'beads' ? 3 : 2, p.gear[giftKind]);
      p.gear[giftKind] -= n;
      const worth = LF.GEAR[giftKind].trade;
      rel = (tongue >= 2 ? 1 : 0) + (worth >= 2 ? 1 : 0.5);
      body = `<p>The ${giftKind === 'tools' ? 'iron hatchets and knives are passed around and tried on firewood' : giftKind === 'cloth' ? 'cloth is unrolled and admired, and the women of the town take charge of it' : 'beads are accepted politely. They have seen glass before'}. ${tongue >= 2 ? `${esc(first(translator))} explains, as well as the language allows, where you have come from.` : 'Nobody can explain much, but the gift says enough.'} These are <strong>${esc(v.name)}</strong>.</p>`;
      v.memory.push(`Strangers came bearing ${LF.GEAR[giftKind].name.toLowerCase()}.`);
    } else if (how === 'arms') {
      const hot = withTrait('hothead');
      if (hot && R() < 0.4) {
        rel = -3;
        const v2 = LF.pick(alive(), R);
        v2.health--;
        body = `<p>Someone moved too fast. ${esc(first(hot))} fired, and arrows answered. The party got away, but ${esc(first(v2))} took an arrow in the shoulder. One man from the town is dead.</p><p>This will not be forgotten.</p>`;
        v.memory.push('Strangers came armed and killed one of ours.');
      } else {
        rel = -2;
        body = `<p>The party comes in with muskets shouldered and matches lit. Nobody comes out to meet it. After a long wait an older man sets a basket of corn on the path and walks back without a word. This meeting will be talked about for years.</p>`;
        v.memory.push('Strangers came armed, as if to war.');
      }
    }
    if (patient && rel >= 0) rel += 0.5;
    if (rival && rival.contacted && rival.relation >= 1) {
      rel -= 0.5;
      body += `<p class="muted">They ask pointed questions about your dealings with ${esc(rival.name)}.</p>`;
    }
    v.relation = clamp(rel, -3, 3);
    plog(`Met ${v.name}. ${v.relation >= 1 ? 'A good meeting.' : v.relation >= 0 ? 'A cautious meeting.' : 'A bad meeting.'}`);
    if (v.relation >= 1) {
      p.gear.rations += 4;
      body += '<p>They send the party off with a sack of parched corn. <span class="muted">+4 rations.</span></p>';
    }
    if (v.relation >= 1 && tongue >= 2) {
      LF.queueModal({ title: LF.cap(v.name), eyebrow: 'First contact', body, locked: true, buttons: [{ label: 'Sit down and talk', primary: true, act: () => talk(v) }] });
      return;
    }
    checkDeaths();
    LF.queueModal({ title: LF.cap(v.name), eyebrow: 'First contact', body, buttons: [{ label: 'Move on', primary: true }] });
  }

  function talk(v, asked) {
    const g = G(), p = g.party;
    asked = asked || new Set();
    const translator = bestAt('tongue');
    const rival = v.rival !== null ? g.world.villages[v.rival] : null;
    const buttons = [];
    if (!asked.has('land')) buttons.push({ label: 'Ask about the land', act: () => {
      asked.add('land');
      tellOfLand(v);
      v.territoryKnown = true;
      LF.queueModal({
        title: LF.cap(v.name),
        body: `<p>The elders draw the country in the dirt with a stick: rivers, marshes, the high ground, the places where the deer come. ${esc(first(translator))} copies it into the notebook. They point out a burying place and ask that it be left alone.</p><p>Then they mark out their hunting grounds, about four miles in every direction from the town, and ask that your people not build inside them.</p>`,
        locked: true,
        buttons: [
          { label: 'Give your word', primary: true, act: () => { v.promised = true; v.relation = Math.min(3, v.relation + 1); v.memory.push('The strangers promised not to settle on our hunting grounds.'); plog(`Promised ${v.name} not to settle in their hunting grounds.`); talk(v, asked); } },
          { label: 'Promise nothing', act: () => { v.memory.push('The strangers would not promise to keep off our hunting grounds.'); plog(`Made ${v.name} no promise.`); talk(v, asked); } },
        ],
      });
    } });
    if (!asked.has('neighbors') && rival) buttons.push({ label: 'Ask about their neighbors', act: () => {
      asked.add('neighbors');
      const d = LF.miles(Math.hypot(rival.x - v.x, rival.y - v.y));
      const b = LF.bearing(rival.x - v.x, rival.y - v.y);
      const p2 = G().party;
      rival.pencil = { x: clamp(rival.x + p2.drift.x + Math.round((R() - 0.5) * 4), 0, W - 1), y: clamp(rival.y + p2.drift.y + Math.round((R() - 0.5) * 4), 0, H - 1) };
      rival.heardOf = true;
      LF.queueModal({ title: LF.cap(v.name), body: `<p>Faces harden. There is a town ${d} to the ${b}, ${esc(rival.name)}. There has been bad blood between them since before anyone here was born: a killing, then another. They would not be sorry to see the strangers take their side.</p><p class="muted">The rough location is marked in the notebook.</p>`, buttons: [{ label: 'Go on', primary: true, act: () => talk(v, asked) }] });
    } });
    if (!asked.has('trade') && (p.gear.tools || p.gear.cloth || p.gear.beads)) buttons.push({ label: 'Trade for corn', act: () => { asked.add('trade'); trade(v, () => talk(v, asked)); } });
    if (!asked.has('guide') && v.relation >= 2 && !v.guideGiven && p.guide === null) buttons.push({ label: 'Ask for a guide', act: () => {
      asked.add('guide');
      v.guideGiven = true;
      p.guide = v.id;
      p.drift = { x: 0, y: 0 };
      plog(`A young hunter from ${v.name} agreed to guide the party.`);
      LF.queueModal({ title: 'A guide', body: `<p>A young hunter agrees to walk with you for a while. With a guide who knows every stream, the party will not lose its way, and the hunting will be better.</p>`, buttons: [{ label: 'Go on', primary: true, act: () => talk(v, asked) }] });
    } });
    buttons.push({ label: 'Take your leave', primary: !buttons.length });
    LF.queueModal({ title: LF.cap(v.name), eyebrow: 'By the fire', body: `<p>${esc(first(translator))} waits for your word. What should be asked?</p>`, buttons, locked: true });
  }

  function trade(v, then) {
    const p = G().party;
    const offers = [['tools', 7], ['cloth', 5], ['beads', 2]].filter(([k]) => p.gear[k] > 0);
    const buttons = offers.map(([k, n]) => ({ label: `A ${LF.GEAR[k].unit} of ${LF.GEAR[k].name.toLowerCase()} for ${n} rations of corn`, act: () => {
      p.gear[k]--;
      p.gear.rations += n;
      v.relation = Math.min(3, v.relation + 0.25);
      plog(`Traded ${LF.GEAR[k].name.toLowerCase()} for corn at ${v.name}.`);
      trade(v, then);
    } }));
    buttons.push({ label: 'That is enough', primary: true, act: then });
    LF.queueModal({ title: 'Trade', body: `<p>They have corn to spare, and they are curious about iron and cloth. The party carries ${Math.floor(p.gear.rations)} rations.</p>`, buttons, locked: true });
  }

  function tellOfLand(v) {
    const p = G().party;
    const o = { skill: 3, sight: 10, dx: p.drift.x, dy: p.drift.y, day: G().day, rng: p.rng, src: 1, errMul: 0.7, hunter: true, closeLook: 10 };
    LF.around(v.x, v.y, 10, (x, y, d) => LF.observe(p.notes, x, y, d, o));
  }

  function visit(v) {
    const p = G().party;
    if (v.relation < 0) {
      plog(`Passed ${v.name}. Nobody came out to meet us.`);
      LF.queueModal({ title: LF.cap(v.name), body: '<p>The town is quiet as you pass. Doors are shut. Nobody comes out.</p>' });
      return;
    }
    const buttons = [];
    if (p.gear.tools || p.gear.cloth || p.gear.beads) buttons.push({ label: 'Trade for corn', primary: true, act: () => trade(v, () => {}) });
    if (skill('tongue') >= 2 && v.relation >= 1) buttons.push({ label: 'Sit down and talk', act: () => talk(v) });
    buttons.push({ label: 'Move on', primary: !buttons.length });
    LF.queueModal({ title: LF.cap(v.name), body: `<p>The party is recognized and welcomed${v.relation >= 1 ? ' warmly' : ', carefully'}.</p>`, buttons });
  }

  // ---------------------------------------------------------------- events on the march

  function floodEvent(dx, dy) {
    const p = G().party;
    const sw = withTrait('swimmer');
    LF.queueModal({
      title: 'The river is running high',
      body: `<p>Snowmelt from the hills has the river up over its banks, brown and fast. ${sw ? `${esc(first(sw))} is a strong swimmer and could take a line across.` : 'Nobody in the party swims well.'}</p>`,
      buttons: [
        { label: 'Wade across roped together', primary: true, act: () => {
          const risk = sw ? 0.08 : 0.3;
          tryStep(dx, dy, true);
          if (!G().party) return;
          if (R() < risk) {
            const v = LF.pick(alive(), R);
            v.health -= 2;
            const lost = Math.ceil(p.gear.rations * 0.3);
            p.gear.rations -= lost;
            if (p.gear.powder) p.gear.powder = Math.max(0, p.gear.powder - 2);
            plog(`${first(v)} lost footing crossing the river. ${lost} rations and some powder went downstream.`);
            LF.queueModal({ title: 'Swept away', body: `<p>Halfway across, ${esc(first(v))} lost footing and went under. The rope held, barely. ${lost} rations and some of the powder went downstream.</p>` });
            checkDeaths();
          } else plog('Waded the river roped together. Everyone got across.');
        } },
        { label: 'Follow the bank to look for a ford (2 hours)', act: () => { p.hour += 2; tryStep(dx, dy, true); plog('Found a shallower place to cross after two hours on the bank.'); } },
        { label: 'Turn back', act: () => {} },
      ],
    });
  }

  function wreckEvent() {
    const g = G(), p = g.party;
    g.flags.wreck = true;
    LF.queueModal({
      title: 'An old wreck',
      body: '<p>The ribs of a ship stick out of the sand, black with age. Whoever she was, she came here before you. There is a sea chest half-buried in the sand under the stern, and her ironwork might still be good.</p>',
      buttons: [
        { label: 'Dig out the chest (3 hours)', primary: true, act: () => {
          p.hour += 3;
          p.gear.powder += 2;
          p.gear.tools += 2;
          plog('Salvaged the old wreck: two pouches of dry powder and two bundles of ironwork.');
          LF.queueModal({ title: 'Salvage', body: '<p>The chest holds a brass compass with a cracked glass, powder sealed in a lead flask, and a roll of spikes and nails. <span class="muted">+2 powder, +2 bundles of tools.</span></p><p>Carved inside the lid: a name, and a date forty years old. Nobody knew any ship had come here.</p>' });
        } },
        { label: 'Leave it', act: () => plog('Passed an old wreck on the beach.') },
      ],
    });
  }

  function ruinEvent() {
    const g = G(), p = g.party;
    g.flags.ruin = true;
    LF.queueModal({
      title: 'An empty town',
      body: '<p>The houses are still standing, but the bark is peeling and grass grows in the doorways. The fields around it are clear and flat, gone to weeds. There are no people, and no sign of a fight. Pots and baskets sit where they were left.</p><p>Whatever happened here, it happened fast. Sickness, most likely.</p>',
      buttons: [
        { label: 'Search the houses', act: () => {
          p.morale = Math.max(0, p.morale - 10);
          p.gear.rations += 3;
          plog('Searched the empty town. Found dried corn. Nobody liked it.');
          LF.queueModal({ title: 'The empty town', body: '<p>There is dried corn in a storage pit, still good. And in the last house, the dead, laid out as if someone meant to come back and bury them. The party leaves quietly. <span class="muted">+3 rations. Spirits are low.</span></p>' });
        } },
        { label: 'Note it and move on', primary: true, act: () => plog('Found an empty town with cleared fields around it.') },
      ],
    });
  }

  function burialEvent() {
    const p = G().party;
    const owner = G().world.villages.reduce((b, v) => (!b || Math.hypot(v.x - p.x, v.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? v : b), null);
    LF.queueModal({
      title: 'A burial ground',
      body: '<p>Low mounds under the trees, some fresh, some old. Grave goods are laid on top of the newest: pots, a copper ornament, a bow.</p>',
      buttons: [
        { label: 'Leave it undisturbed', primary: true, act: () => plog('Found a burial ground and left it alone.') },
        { label: 'Take the copper and the pots', act: () => {
          p.gear.beads += 4;
          owner.relation = Math.max(-3, owner.relation - 2);
          owner.memory.push('Strangers robbed our dead.');
          plog('Took grave goods from a burial ground.');
          LF.queueModal({ title: 'Grave goods', body: `<p>The copper is good. Someone will notice it is gone. <span class="muted">Word will reach ${esc(owner.name)}.</span></p>` });
        } },
      ],
    });
  }

  function summit() {
    const p = G().party;
    const s = bestAt('survey');
    const o = { skill: Math.max(1, skill('survey')), sight: 14, dx: p.drift.x, dy: p.drift.y, day: G().day, rng: p.rng, errMul: 1.1, closeLook: -1 };
    LF.around(p.x, p.y, 13, (x, y, d, i) => { LF.observe(p.notes, x, y, d, o); p.seen.add(i); });
    let msg = 'From the summit the whole country is spread out below: rivers, marshes, the line of the coast.';
    if (s && s.survey >= 2 && p.gear.compass && (p.drift.x || p.drift.y)) {
      p.drift = { x: 0, y: 0 };
      msg += ` ${first(s)} takes bearings on the coast and fixes the party’s true position.`;
    }
    plog(msg);
    LF.toast('A view from the summit');
  }

  const DAY_EVENTS = [
    {
      id: 'tracks', w: 3,
      ok: (p, g) => g.world.villages.some((v) => !v.contacted && Math.hypot(v.x - p.x, v.y - p.y) < 14),
      run(p, g) {
        const v = g.world.villages.filter((v) => !v.contacted).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        const b = LF.bearing(v.x - p.x, v.y - p.y);
        return {
          title: 'Tracks',
          body: `<p>A well-used path crosses your line, beaten hard by many feet. Fresh tracks lead ${b}.</p>`,
          buttons: [
            { label: `Follow them ${b}`, primary: true, act: () => {
              const steps = 8;
              const o = { skill: skill('survey'), sight: 4, dx: p.drift.x, dy: p.drift.y, day: g.day, rng: p.rng, errMul: 1.2 };
              for (let k = 1; k <= steps; k++) {
                const x = Math.round(p.x + ((v.x - p.x) * k) / steps / 1.3), y = Math.round(p.y + ((v.y - p.y) * k) / steps / 1.3);
                LF.around(x, y, 1.5, (ax, ay, d) => LF.observe(p.notes, ax, ay, d + 2, o));
              }
              plog(`Found a footpath leading ${b}. Sketched its course.`);
            } },
            { label: 'Stay off the path', act: () => plog('Found a footpath and kept clear of it.') },
          ],
        };
      },
    },
    {
      id: 'hunters', w: 2,
      ok: (p, g) => g.world.villages.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < v.radius + 3 && !p.avoided.has(v.id)),
      run(p, g) {
        const v = g.world.villages.find((v) => Math.hypot(v.x - p.x, v.y - p.y) < v.radius + 3 && !p.avoided.has(v.id));
        if (!v.contacted) { contact(v, 'hunters'); return null; }
        if (v.relation >= 1) {
          p.gear.rations += 5;
          plog(`Met hunters from ${v.name}. They shared their kill.`);
          return { title: 'Hunters', body: `<p>A hunting party from ${esc(v.name)} is dressing a deer by a stream. They wave you over and cut you a share. <span class="muted">+5 rations.</span></p>` };
        }
        if (v.relation < 0) {
          return {
            title: 'Hunters',
            body: `<p>Men from ${esc(v.name)} are watching from the ridge. They make no move to come closer. Nor do they leave.</p>`,
            buttons: [
              { label: 'Hold up a gift and wait', primary: true, disabled: !(p.gear.tools || p.gear.cloth), act: () => {
                const k = p.gear.tools ? 'tools' : 'cloth';
                p.gear[k]--;
                v.relation = Math.min(3, v.relation + 1);
                v.memory.push('The strangers tried to make amends.');
                plog(`Left a gift for men of ${v.name}. They took it.`);
              } },
              { label: 'Move on quickly', act: () => { p.hour += 1; plog(`Hurried away from men of ${v.name}.`); } },
            ],
          };
        }
        return { title: 'Hunters', body: `<p>Hunters from ${esc(v.name)} pass by at a distance and raise a hand. Nothing more.</p>` };
      },
    },
    {
      id: 'snake', w: 2,
      ok: (p, g) => (LF.isHigh(here()) || LF.isOpen(here())) && LF.season(g.day) === 'summer',
      run(p) {
        const v = LF.pick(alive(), R);
        const healer = alive().find((m) => m.heal >= 2);
        return {
          title: 'Snakebite',
          body: `<p>${esc(first(v))} stepped on a rattlesnake sunning itself on a rock. Two punctures above the ankle, already swelling.</p>`,
          buttons: [
            { label: healer ? `${first(healer)} cuts and draws the wound` : 'Cut and draw the wound', primary: true, act: () => {
              if (healer || p.gear.medicine) { if (p.gear.medicine) p.gear.medicine--; plog(`${first(v)} was bitten by a snake. The wound was drawn in time.`); v.fatigue = 100; }
              else { v.health -= 2; plog(`${first(v)} was bitten by a snake and is very sick.`); checkDeaths(); }
            } },
            { label: 'Rest here until the swelling goes down (4 hours)', act: () => { p.hour += 4; if (R() < 0.5) v.health--; plog(`${first(v)} was bitten by a snake. The party waited.`); checkDeaths(); } },
          ],
        };
      },
    },
    {
      id: 'deer', w: 3,
      ok: (p) => LF.isOpen(here()) || LF.isWoods(here()),
      run(p) {
        const h = bestAt('forage');
        return {
          title: 'Deer',
          body: `<p>A herd of deer is grazing at the edge of the trees, downwind, not a hundred yards off.</p>`,
          buttons: [
            { label: 'Take a shot', primary: true, disabled: !p.gear.powder || !h || h.forage < 1, act: () => {
              p.gear.powder--;
              if (R() < 0.35 + h.forage * 0.18) { p.gear.rations += 8; p.hour += 1.5; p.morale = Math.min(100, p.morale + 6); plog(`${first(h)} dropped a buck. Venison for days.`); LF.toast('+8 rations'); }
              else plog(`${first(h)} missed. The herd crashed off into the woods.`);
            } },
            { label: 'Let them be', act: () => {} },
          ],
        };
      },
    },
    {
      id: 'quarrel', w: 2,
      ok: (p) => p.morale < 50 && alive().length >= 3,
      run(p) {
        const [a, b] = LF.shuffle(alive(), R);
        return {
          title: 'A quarrel',
          body: `<p>${esc(first(a))} and ${esc(first(b))} have been at each other all morning, about the route, the food, whose turn it is to carry what. Now there is shoving.</p>`,
          buttons: [
            { label: `Back ${first(a)}`, act: () => { p.morale -= 4; plog(`Settled a quarrel in ${first(a)}’s favor. ${first(b)} is sulking.`); } },
            { label: `Back ${first(b)}`, act: () => { p.morale -= 4; plog(`Settled a quarrel in ${first(b)}’s favor. ${first(a)} is sulking.`); } },
            { label: 'Stop for an hour and let everyone cool off', primary: true, act: () => { p.hour += 1; p.morale += 6; for (const m of alive()) m.fatigue = Math.max(0, m.fatigue - 10); plog('Stopped for an hour to let tempers cool.'); } },
          ],
        };
      },
    },
    {
      id: 'mosquitoes', w: 3,
      ok: (p, g) => LF.isWet(here()) && LF.season(g.day) === 'summer',
      run(p) {
        p.morale -= 6;
        for (const m of alive()) m.fatigue = Math.min(100, m.fatigue + 12);
        plog('Mosquitoes in clouds. Nobody can think of anything else.');
        return { title: 'Mosquitoes', body: '<p>They rise out of the marsh grass in clouds. Faces swell, tempers fray, and nobody can think about anything else.</p>' };
      },
    },
    {
      id: 'lostchild', w: 1, once: true,
      ok: (p, g) => g.world.villages.some((v) => Math.hypot(v.x - p.x, v.y - p.y) < 16),
      run(p, g) {
        const v = g.world.villages.filter((v) => Math.hypot(v.x - p.x, v.y - p.y) < 16).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        const b = LF.bearing(v.x - p.x, v.y - p.y);
        return {
          title: 'A lost child',
          body: `<p>A boy of eight or nine is sitting under a tree, crying. He has been lost for two days. He points ${b} when you say anything, over and over.</p>`,
          buttons: [
            { label: 'Take him home (half a day)', primary: true, act: () => {
              p.hour += 5;
              v.relation = Math.min(3, v.relation + (v.contacted ? 1 : 1.5));
              v.memory.push('The strangers brought home a lost child.');
              p.gear.rations += 4;
              plog(`Brought a lost boy home to ${v.name}.`);
              if (!v.contacted) {
                v.contacted = true;
                v.pencil = { x: clamp(v.x + p.drift.x, 0, W - 1), y: clamp(v.y + p.drift.y, 0, H - 1) };
                LF.queueModal({ title: LF.cap(v.name), body: `<p>You bring the boy into ${esc(v.name)}. His mother runs to him, and the town’s suspicion turns in an instant to welcome. Whatever else happens, this will be remembered. <span class="muted">+4 rations of corn.</span></p>` });
              }
            } },
            { label: 'Give him food and point him on his way', act: () => { p.gear.rations = Math.max(0, p.gear.rations - 1); plog('Gave food to a lost boy and left him.'); } },
          ],
        };
      },
    },
    {
      id: 'sprain', w: 2,
      ok: () => LF.isHigh(here()) || LF.isWet(here()),
      run(p) {
        const v = withTrait('clumsy') || LF.pick(alive(), R);
        v.fatigue = Math.min(100, v.fatigue + 40);
        plog(`${first(v)} turned an ankle. Going will be slower.`);
        return { title: 'A turned ankle', body: `<p>${esc(first(v))} went over on a loose stone. Nothing broken, but ${esc(first(v))} will be slow for a day or two.</p>` };
      },
    },
    {
      id: 'spoiled', w: 1,
      ok: (p) => p.gear.rations > 10,
      run(p) {
        const n = Math.ceil(p.gear.rations * 0.2);
        p.gear.rations -= n;
        plog(`Found maggots in the salt pork. ${n} rations thrown away.`);
        return { title: 'Spoiled food', body: `<p>The salt pork was badly packed. ${n} rations are crawling with maggots and have to be thrown away.</p>` };
      },
    },
  ];

  function dayEvent() {
    const g = G(), p = g.party;
    if (p.steps - p.lastEvent < 10 || p.hour >= DUSK) return false;
    if (R() > 0.06) return false;
    const pool = DAY_EVENTS.filter((e) => e.ok(p, g) && !(e.once && g.flags['ev_' + e.id]));
    if (!pool.length) return false;
    let tot = pool.reduce((s, e) => s + e.w, 0), u = R() * tot;
    let ev = pool[0];
    for (const e of pool) if ((u -= e.w) <= 0) { ev = e; break; }
    p.lastEvent = p.steps;
    if (ev.once) g.flags['ev_' + ev.id] = true;
    stopWalk();
    const m = ev.run(p, g);
    if (m) LF.queueModal({ ...m, eyebrow: `${clockText(p.hour)}, ${LF.dateOf(g.day).name}` });
    return true;
  }

  // ---------------------------------------------------------------- walking

  let walkTimer = null;
  function stopWalk() {
    if (walkTimer) clearTimeout(walkTimer);
    walkTimer = null;
  }
  function walk(path) {
    stopWalk();
    const next = () => {
      if (!path.length || !G().party || LF.modalOpen()) return stopWalk();
      const [x, y] = path.shift();
      const ok = tryStep(x - G().party.x, y - G().party.y);
      if (ok && path.length) walkTimer = setTimeout(next, 90);
      else walkTimer = null;
    };
    next();
  }

  function findPath(from, to, allowed) {
    const dist = new Float32Array(W * H).fill(Infinity);
    const prev = new Int32Array(W * H).fill(-1);
    const start = idx(from.x, from.y), goal = idx(to.x, to.y);
    dist[start] = 0;
    const heap = [[0, start]];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
    const pop = () => { const top = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, i] = pop();
      if (d > dist[i]) continue;
      if (i === goal) break;
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of LF.N4) {
        const ax = x + dx, ay = y + dy;
        if (!inb(ax, ay)) continue;
        const j = idx(ax, ay);
        if (!allowed(j)) continue;
        const c = stepCost(ax, ay, x, y, true);
        if (!isFinite(c)) continue;
        const nd = d + c;
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
    const p = G().party;
    if (!p || LF.modalOpen()) return;
    const res = findPath(p, G().world.camp, (j) => p.seen.has(j));
    if (!res) return LF.toast('The party cannot find its way back along ground it has seen.');
    walk(res.path);
  }

  const visibleNow = (x, y) => {
    const p = G().party;
    return inb(x, y) && Math.hypot(x - p.x, y - p.y) <= sightRadius() + 0.01;
  };

  // ---------------------------------------------------------------- field view hooks

  let fieldCam = null, hover = null, hoverPath = null;

  LF.usesChart.field = () => G().showMap;
  LF.animating.field = () => !G().showMap;
  LF.chartExtras.field = () => ({ notes: G().party.notes, party: G().party, title: 'The chart, with field notes in pencil' });
  LF.stageDrawers.field = (c, dpr) => {
    const g = G(), p = g.party;
    if (!p || g.showMap) return false;
    const s = clamp(Math.min(c.width, c.height) / dpr / 15, 26, 58);
    fieldCam = { s, dpr, cx: p.x, cy: p.y };
    p.alive = alive();
    LF.drawField(c, { world: g.world, party: p, cam: fieldCam, time: performance.now(), hover, path: hoverPath, stakes: p.stakes, camp: g.world.camp, ship: g.world.ship, sight: sightRadius(), light: light(), fire: p.camping || p.hour >= DUSK + 1 });
    const clock = $('#clock');
    clock.hidden = false;
    clock.innerHTML = `<span class="sun" style="--t:${clamp((p.hour - 6) / 12, 0, 1)}"></span><strong>${clockText(p.hour)}</strong><span>${esc(LF.dateOf(g.day).name)}</span>`;
    return true;
  };

  function tileAt(ev) {
    const r = LF.canvas().getBoundingClientRect();
    const s = fieldCam.s;
    const ox = r.width / 2 - (fieldCam.cx + 0.5) * s, oy = r.height / 2 - (fieldCam.cy + 0.5) * s;
    return [Math.floor((ev.clientX - r.left - ox) / s), Math.floor((ev.clientY - r.top - oy) / s)];
  }

  LF.pointer.field = {
    move(ev) {
      const g = G();
      if (g.showMap || !g.party || !fieldCam || ev.pointerType !== 'mouse') return;
      const [x, y] = tileAt(ev);
      if (hover && hover[0] === x && hover[1] === y) return;
      hover = [x, y];
      hoverPath = null;
      if (!visibleNow(x, y)) { LF.tip(null); return; }
      const w = g.world, i = idx(x, y);
      let t = LF.T_NAME[w.t[i]] + (w.river[i] ? ', river' : '');
      const f = w.feat[i];
      if (f && Math.hypot(x - g.party.x, y - g.party.y) <= 2.3 && (f !== F.BURIAL || Math.hypot(x - g.party.x, y - g.party.y) <= 1.5)) t += ` · ${LF.F_INFO[f].name}`;
      if (x !== g.party.x || y !== g.party.y) {
        const res = findPath(g.party, { x, y }, (j) => visibleNow(j % W, (j / W) | 0));
        if (res) { hoverPath = res.path; t += ` · ${res.cost} hours`; }
      }
      LF.tip(t);
    },
    leave() { hover = null; hoverPath = null; },
    click(ev) {
      const g = G();
      if (g.showMap || !g.party) return;
      const [x, y] = tileAt(ev);
      if (!visibleNow(x, y)) return;
      const res = findPath(g.party, { x, y }, (j) => visibleNow(j % W, (j / W) | 0));
      hoverPath = null;
      if (res) walk(res.path);
    },
  };

  LF.keys.field = (ev) => {
    const g = G();
    if (!g.party) return;
    const k = ev.key.toLowerCase();
    const dir = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] }[k];
    if (dir) {
      ev.preventDefault();
      stopWalk();
      if (g.showMap) g.showMap = false;
      tryStep(dir[0], dir[1]);
      LF.render();
    } else if (k === 'm') { g.showMap = !g.showMap; LF.render(); }
    else if (k === 'c') openCamp();
  };

  LF.ledgers.field = () => {
    const g = G(), p = g.party;
    const left = LF.DEADLINE - g.day;
    const daysFood = alive().length ? Math.floor(p.gear.rations / alive().length) : 0;
    return `
      <div class="chip ${left < 0 ? 'bad' : left <= 7 ? 'warn' : ''}"><span class="k">${esc(LF.dateOf(g.day).name)}</span><span class="v">${left >= 0 ? `${left}<small> days left</small>` : `${-left}<small> days late</small>`}</span></div>
      <div class="chip ${daysFood <= 2 ? 'bad' : ''}"><span class="k">Party food</span><span class="v">${Math.floor(p.gear.rations)}<small> rations</small></span></div>
      <div class="chip ${p.morale < 30 ? 'bad' : p.morale < 50 ? 'warn' : ''}"><span class="k">Spirits</span><span class="v">${p.morale >= 70 ? 'High' : p.morale >= 45 ? 'Fair' : p.morale >= 25 ? 'Low' : 'Breaking'}</span></div>
      <div class="chip"><span class="k">Powder</span><span class="v">${p.gear.powder}</span></div>`;
  };

  LF.panels.field = {
    html() {
      const g = G(), p = g.party, w = g.world;
      const k = here();
      const dx = w.camp.x - p.x, dy = w.camp.y - p.y;
      const dist = Math.hypot(dx, dy);
      const daysFood = alive().length ? Math.floor(p.gear.rations / alive().length) : 0;
      const log = p.log.slice(-8).reverse().map((l) => `<li><span class="d">${esc(LF.dateOf(l.day).name)}</span> ${esc(l.text)}</li>`).join('');
      const membersHtml = p.members.map((id) => {
        const m = LF.crewById(id);
        return `<li class="${m.alive ? '' : 'dead'}"><div><strong>${esc(m.name)}</strong> <span class="role">${esc(m.role)}</span></div>
          <div class="sub">${m.alive ? `${LF.pips(m.health, 3, 'hp')} <span class="fatbar" title="Fatigue">${LF.meter(m.fatigue, 'fatigue')}</span>` : 'Dead'}</div></li>`;
      }).join('');
      const gear = LF.GEAR_ORDER.filter((key) => key !== 'rations' && p.gear[key] > 0).map((key) => `${LF.GEAR[key].name}${LF.GEAR[key].single ? '' : ` ×${p.gear[key]}`}`).join(', ') || 'Nothing but food';
      const paces = Object.entries(LF.PACES).map(([key, v]) => `<label class="radio mini"><input type="radio" name="fpace" value="${key}" id="fpace-${key}" ${p.pace === key ? 'checked' : ''}><span><strong>${v.name}</strong></span></label>`).join('');
      const nearFeat = [];
      LF.around(p.x, p.y, 2.3, (x, y, d, i) => { const f = w.feat[i]; if (f && (f !== F.BURIAL || d <= 1.5)) nearFeat.push(LF.F_INFO[f].name); });
      const guide = p.guide !== null ? `<p class="hint">A hunter from ${esc(w.villages[p.guide].name)} is guiding the party.</p>` : '';
      return `
        <h2>In the field</h2>
        <dl class="facts">
          <dt>Standing in</dt><dd>${LF.T_NAME[k]}${w.river[idx(p.x, p.y)] ? ', by a river' : ''}${p.canoeOn ? ', in the canoe' : ''}</dd>
          ${nearFeat.length ? `<dt>Close by</dt><dd>${esc([...new Set(nearFeat)].join(', '))}</dd>` : ''}
          <dt>Food</dt><dd class="${daysFood <= 2 ? 'bad' : ''}">${Math.floor(p.gear.rations)} rations, about ${LF.plural(daysFood, 'day')}</dd>
          <dt>Carrying</dt><dd>${esc(gear)}</dd>
          <dt>The landing</dt><dd>${dist < 1 ? 'Here' : `${LF.miles(dist)} ${LF.bearing(dx, dy)}`}</dd>
        </dl>
        ${guide}
        <div class="actions">
          <button class="btn primary" id="b-home">Head back to the landing</button>
          <button class="btn" id="b-stake">Plant a survey stake</button>
          <button class="btn" id="b-map">${g.showMap ? 'Put the chart away' : 'Consult the chart'}</button>
          <button class="btn" id="b-camp">Make camp${p.hour < 16 ? ' early' : ''}</button>
        </div>
        <div class="radios row">${paces}</div>
        <p class="hint">Arrow keys or WASD walk half a mile. Click any ground you can see to walk there. Dusk falls at six.</p>
        <h3>Party</h3>
        <ul class="crew">${membersHtml}</ul>
        <h3>Field notes</h3>
        <ul class="journal">${log}</ul>`;
    },
    wire() {
      const g = G();
      const on = (id, fn) => { const el = $('#' + id); if (el) el.onclick = fn; };
      on('b-home', walkHome);
      on('b-stake', plantStake);
      on('b-map', () => { g.showMap = !g.showMap; LF.render(); });
      on('b-camp', () => { stopWalk(); openCamp(); });
      document.querySelectorAll('input[name=fpace]').forEach((r) => (r.onchange = () => { g.party.pace = r.value; LF.render(); }));
    },
  };
})();
