// Founding: lay out the town on the chart, go ashore, and live through the first year.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, esc, clamp, num, Num, first, listJoin } = LF;
  const $ = LF.$;
  const G = () => LF.G;
  const N = LF.LOCAL_N;
  const B = LF.BUILDINGS;

  const TURN = 14;
  const END_DAY = 366;
  const HARVEST_DAY = 148;
  const QUOTA = 500;

  // ---------------------------------------------------------------- beginning

  LF.beginFounding = function (site) {
    const g = G();
    const R0 = LF.LOCAL_R;
    const cx = clamp(site.x, R0, W - 1 - R0), cy = clamp(site.y, R0, H - 1 - R0);
    const Lplan = LF.buildLocal({ t: g.K.t, river: g.K.river, feat: g.K.feat }, cx, cy, false, g.seed);
    g.colony = {
      site, cx, cy,
      Lplan,
      Ltrue: null,
      items: [],
      nextId: 1,
      tool: 'house',
      phase: 'plan',
      log: [],
      chronicle: [],
      deaths: [],
    };
    g.mode = 'plan';
    LF.resetCams();
    LF.render();
    LF.showModal({
      title: 'Lay out the town',
      eyebrow: `${site.name}, ${LF.dateOf(g.day).name}`,
      body: `<p>While the <em>Constant</em> works along the coast, you sit with Fenwick over the chart of ${esc(site.name)} and plan the town: fields, houses, a storehouse, a well, perhaps a palisade.</p><p>This plan is drawn on the chart, and the chart is only as good as your surveys. When you go ashore you will see the ground as it really is.</p><p class="muted">Pick a building on the right, then click the map to place it. Drag to paint fields or to draw a palisade. Or let Fenwick draft a plan for you.</p>`,
      buttons: [{ label: 'To the drawing table', primary: true }],
    });
  };

  // ---------------------------------------------------------------- placement rules

  function cellsOf(it) {
    const out = [];
    if (it.type === 'palisade') {
      for (let x = it.x0; x <= it.x1; x++) { out.push([x, it.y0], [x, it.y1]); }
      for (let y = it.y0 + 1; y < it.y1; y++) { out.push([it.x0, y], [it.x1, y]); }
      return out;
    }
    for (let y = it.y; y < it.y + it.h; y++) for (let x = it.x; x < it.x + it.w; x++) out.push([x, y]);
    return out;
  }
  function itemAt(x, y) {
    const c = G().colony;
    for (let k = c.items.length - 1; k >= 0; k--) {
      const it = c.items[k];
      if (it.type === 'palisade') { if (cellsOf(it).some(([a, b]) => a === x && b === y)) return it; continue; }
      if (x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h) return it;
    }
    return null;
  }
  function nearFeat(L, x, y, f, r) {
    for (const [i, ff] of L.feat) if (ff === f && Math.hypot((i % N) - x, ((i / N) | 0) - y) <= r) return true;
    return false;
  }
  function touchesWater(L, cells) {
    return cells.some(([x, y]) => LF.N4.some(([dx, dy]) => LF.localIn(x + dx, y + dy) && LF.localWater(L, (y + dy) * N + x + dx)));
  }

  // Why an item cannot go here on map L, or null.
  function problem(L, it, known) {
    const cells = cellsOf(it);
    for (const [x, y] of cells) {
      if (!LF.localIn(x, y)) return 'Off the map.';
      const i = y * N + x, k = L.t[i];
      if (k < 0) { if (known) return 'Nobody has surveyed this ground.'; continue; }
      if (LF.isWater(k) || L.river[i]) return it.type === 'palisade' ? null : 'Open water.';
      if (it.type !== 'palisade' && (k === T.SWAMP || k === T.SALTMARSH)) return it.type === 'field' ? 'Marsh. Nothing will grow.' : 'Marsh. It would sink.';
      if (it.type !== 'field' && it.type !== 'palisade' && k === T.MOUNTAIN) return 'Too steep to build.';
    }
    if (it.type === 'dock' && !touchesWater(L, cells)) return 'A dock has to touch the water.';
    if (it.type === 'mill' && !nearFeat(L, it.x, it.y, F.FALLS, 3)) return 'A mill needs falls within a few hundred yards.';
    if (it.type === 'kiln' && !nearFeat(L, it.x, it.y, F.CLAY, 5)) return 'A kiln needs clay nearby.';
    return null;
  }

  function laborFor(L, it) {
    const b = B[it.type];
    if (it.type === 'palisade') return cellsOf(it).length * b.labor;
    if (it.type !== 'field') return b.labor;
    const k = L.t[it.y * N + it.x];
    if (k === T.OLDFIELD) return 6;
    if (k === T.MEADOW) return 10;
    if (k === T.BEACH) return 12;
    if (LF.isHigh(k)) return 22;
    if (LF.isWoods(k)) return 38;
    return 10;
  }
  function timberFor(it) {
    const b = B[it.type];
    return it.type === 'palisade' ? cellsOf(it).length * b.timber : b.timber;
  }

  function addItem(it) {
    const c = G().colony;
    const L = c.Ltrue || c.Lplan;
    const known = !c.Ltrue;
    const why = problem(L, it, false);
    if (why) { LF.toast(why); return false; }
    if (it.type !== 'palisade' && cellsOf(it).some(([x, y]) => { const o = itemAt(x, y); return o && o.type !== 'palisade'; })) { LF.toast('Something is already planned there.'); return false; }
    if (known && cellsOf(it).some(([x, y]) => c.Lplan.t[y * N + x] < 0) && it.type !== 'palisade') LF.toast('Unsurveyed ground. You are guessing.');
    it.id = c.nextId++;
    it.progress = 0;
    it.labor = laborFor(L, it);
    it.timber = timberFor(it);
    if (it.type === 'field') it.crop = 'corn';
    c.items.push(it);
    return true;
  }

  // ---------------------------------------------------------------- Fenwick's draft

  function autoPlan() {
    const c = G().colony;
    const L = c.Lplan;
    c.items = [];
    const mid = N / 2;
    const pop = LF.settlersAboard() + G().crew.filter((m) => m.alive).length;
    const ok = (x, y) => LF.localIn(x, y) && L.t[y * N + x] >= 0 && !LF.isWater(L.t[y * N + x]) && !L.river[y * N + x] && !LF.isWet(L.t[y * N + x]) && L.t[y * N + x] !== T.MOUNTAIN;
    // Find the best dry spot near the centre for the town core.
    let core = null, bd = Infinity;
    for (let y = 8; y < N - 8; y++)
      for (let x = 8; x < N - 8; x++) {
        let good = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (ok(x + dx, y + dy)) good++;
        if (good < 44) continue;
        let water = 0;
        for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) if (LF.localIn(x + dx, y + dy) && LF.localWater(L, (y + dy) * N + x + dx)) water = 1;
        const d = Math.hypot(x - mid, y - mid) - water * 4;
        if (d < bd) { bd = d; core = [x, y]; }
      }
    if (!core) { LF.toast('Fenwick cannot find enough dry ground on this chart.'); return; }
    const [cx, cy] = core;
    const houses = Math.ceil(pop / 8);
    const tryPlace = (type, w, h, near, maxR) => {
      for (let r = 0; r <= (maxR || 8); r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const it = { type, x: near[0] + dx, y: near[1] + dy, w, h };
            if (cellsOf(it).some(([x, y]) => !ok(x, y) && type !== 'dock') || problem(L, it, true)) continue;
            if (cellsOf(it).some(([x, y]) => itemAt(x, y))) continue;
            if (addItem(it)) return true;
          }
      return false;
    };
    tryPlace('storehouse', 2, 1, [cx - 1, cy]);
    for (let k = 0; k < houses; k++) tryPlace('house', 1, 1, [cx + ((k % 4) - 1.5) * 2 | 0, cy + (k < 4 ? -2 : 2)], 5);
    if (!nearWaterCells(L, cx, cy, 7)) tryPlace('well', 1, 1, [cx, cy + 1]);
    tryPlace('meetinghouse', 2, 1, [cx + 1, cy + 1]);
    const pal = { type: 'palisade', x0: cx - 4, y0: cy - 4, x1: cx + 4, y1: cy + 4, w: 1, h: 1 };
    if (!problem(L, pal, false)) addItem(pal);
    // Fields on the best open ground within a mile.
    const spots = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (!ok(x, y) || itemAt(x, y)) continue;
        if (Math.abs(x - cx) <= 4 && Math.abs(y - cy) <= 4) continue;
        const k = L.t[y * N + x];
        const score = (k === T.OLDFIELD ? 3 : LF.isOpen(k) ? 2 : k === T.BEACH ? 0.5 : LF.isWoods(k) ? 0.3 : 0.6) - Math.hypot(x - cx, y - cy) / 10;
        spots.push([score, x, y]);
      }
    spots.sort((a, b) => b[0] - a[0]);
    for (const [, x, y] of spots.slice(0, 16)) addItem({ type: 'field', x, y, w: 1, h: 1 });
    // A dock if the water is close.
    for (let r = 1; r < 10; r++) {
      let done = false;
      for (let dy = -r; dy <= r && !done; dy++)
        for (let dx = -r; dx <= r && !done; dx++) {
          const it = { type: 'dock', x: cx + dx, y: cy + dy, w: 1, h: 1 };
          if (!problem(L, it, true) && !itemAt(it.x, it.y)) done = addItem(it);
        }
      if (done) break;
    }
    LF.localCam = null;
    LF.render();
  }
  // Fresh water only: a river, a pond or a spring. The sea does not count.
  function nearWaterCells(L, x, y, r) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (!LF.localIn(x + dx, y + dy)) continue;
        const i = (y + dy) * N + x + dx;
        if (L.river[i] || L.t[i] === T.LAKE || L.feat.get(i) === F.SPRING) return true;
      }
    return false;
  }

  // ---------------------------------------------------------------- local camera and pointer

  // Open on the town itself, about three miles across, rather than the whole map.
  function fitLocal() {
    const c = LF.canvas();
    const dpr = window.devicePixelRatio || 1;
    const cw = c.width / dpr, ch = c.height / dpr;
    const col = G().colony;
    let cx = N / 2, cy = N / 2;
    const built = col ? col.items.filter((i) => i.type !== 'palisade') : [];
    if (built.length) {
      cx = built.reduce((a, i) => a + i.x + i.w / 2, 0) / built.length;
      cy = built.reduce((a, i) => a + i.y + i.h / 2, 0) / built.length;
    }
    const s = Math.max(Math.min((cw - 20) / N, (ch - 20) / N), Math.min(cw, ch) / 28);
    LF.localCam = { s, ox: cw / 2 - cx * s, oy: ch / 2 - cy * s, dpr };
  }
  LF.fitLocal = fitLocal;
  const lcam = () => { if (!LF.localCam) fitLocal(); LF.localCam.dpr = window.devicePixelRatio || 1; return LF.localCam; };
  for (const m of ['plan', 'colony']) {
    LF.panners[m] = lcam;
    LF.zoomers[m] = (mx, my, f) => {
      const cam = lcam();
      const ns = clamp(cam.s * f, 6, 60);
      const k = ns / cam.s;
      cam.ox = mx - (mx - cam.ox) * k;
      cam.oy = my - (my - cam.oy) * k;
      cam.s = ns;
      LF.drawStage();
    };
  }

  let hoverCell = null, dragStart = null, painting = false;
  function cellAt(ev) {
    const r = LF.canvas().getBoundingClientRect();
    const cam = lcam();
    return [Math.floor((ev.clientX - r.left - cam.ox) / cam.s), Math.floor((ev.clientY - r.top - cam.oy) / cam.s)];
  }
  function toolFootprint(x, y) {
    const c = G().colony;
    const t = c.tool;
    if (t === 'erase') return { type: 'erase', x, y, w: 1, h: 1 };
    if (t === 'palisade') {
      if (dragStart) return { type: 'palisade', x0: Math.min(dragStart[0], x), y0: Math.min(dragStart[1], y), x1: Math.max(dragStart[0], x), y1: Math.max(dragStart[1], y), w: 1, h: 1 };
      return { type: 'palisade', x0: x, y0: y, x1: x, y1: y, w: 1, h: 1 };
    }
    return { type: t, x, y, w: B[t].w, h: B[t].h };
  }

  const pointerLocal = {
    down(ev) {
      const c = G().colony;
      if (!c || ev.button !== 0 || ev.shiftKey) return false;
      const [x, y] = cellAt(ev);
      if (!LF.localIn(x, y)) return false;
      LF.canvas().setPointerCapture(ev.pointerId);
      if (c.tool === 'palisade') { dragStart = [x, y]; return true; }
      if (c.tool === 'field' || c.tool === 'erase') { painting = true; applyAt(x, y); return true; }
      applyAt(x, y);
      return true;
    },
    move(ev) {
      const c = G().colony;
      if (!c) return;
      const [x, y] = cellAt(ev);
      if (!LF.localIn(x, y)) { hoverCell = null; LF.tip(null); LF.drawStage(); return; }
      if (painting) applyAt(x, y);
      hoverCell = [x, y];
      const L = c.Ltrue || c.Lplan;
      const i = y * N + x, k = L.t[i];
      const it = itemAt(x, y);
      let t = k < 0 ? 'Unsurveyed' : L.river[i] ? 'River' : LF.T_NAME[k];
      const f = L.feat.get(i);
      if (f) t += ` · ${LF.F_INFO[f].name}`;
      if (it) t += ` · ${B[it.type].name}${it.blocked ? ' (cannot be built)' : it.progress >= 1 ? '' : ` (${Math.round(it.progress * 100)}% built)`}`;
      LF.tip(t);
      LF.drawStage();
    },
    up() {
      const c = G().colony;
      if (!c) return;
      if (dragStart && hoverCell && c.tool === 'palisade') {
        const it = toolFootprint(hoverCell[0], hoverCell[1]);
        if (it.x1 - it.x0 < 3 || it.y1 - it.y0 < 3) LF.toast('Drag out a larger rectangle for the palisade.');
        else {
          c.items = c.items.filter((o) => o.type !== 'palisade' || o.progress > 0);
          addItem(it);
        }
      }
      dragStart = null;
      painting = false;
      LF.render();
    },
    leave() { hoverCell = null; LF.drawStage(); },
  };
  LF.pointer.plan = pointerLocal;
  LF.pointer.colony = pointerLocal;

  function applyAt(x, y) {
    const c = G().colony;
    if (c.tool === 'erase') {
      const it = itemAt(x, y);
      if (it && (it.progress || 0) === 0) { c.items = c.items.filter((o) => o !== it); LF.drawStage(); refreshPanelSoon(); }
      else if (it) LF.toast('Already begun. It stays.');
      return;
    }
    if (c.tool === 'field' && itemAt(x, y)) return;
    const it = toolFootprint(x, y);
    if (addItem(it)) { LF.drawStage(); refreshPanelSoon(); }
  }
  let refreshT = null;
  function refreshPanelSoon() {
    clearTimeout(refreshT);
    refreshT = setTimeout(() => LF.render(), 120);
  }

  function hoverOverlay() {
    const c = G().colony;
    if (!hoverCell || !c) return null;
    const it = toolFootprint(hoverCell[0], hoverCell[1]);
    if (it.type === 'erase') return { cells: [hoverCell], ok: !!itemAt(hoverCell[0], hoverCell[1]) };
    const L = c.Ltrue || c.Lplan;
    return { cells: cellsOf(it).filter(([x, y]) => LF.localIn(x, y)), ok: !problem(L, it, false) };
  }

  // ---------------------------------------------------------------- plan screen

  LF.usesChart.plan = () => true;
  LF.stageDrawers.plan = (cv) => {
    const c = G().colony;
    LF.drawLocal(cv, { L: c.Lplan, cam: lcam(), truth: false, items: c.items, hover: hoverOverlay(), title: `A plan of ${c.site.name}, drawn from the chart`, ring: null });
    return true;
  };

  function toolbox() {
    const c = G().colony;
    const tools = [...LF.BUILD_ORDER, 'erase'].map((k) => {
      const b = B[k];
      const label = k === 'erase' ? 'Remove' : b.name;
      const cost = k === 'erase' ? 'Unbuilt items only' : k === 'field' ? 'Labor depends on ground' : `${b.labor} days${b.timber ? `, ${b.timber} timber` : ''}${k === 'palisade' ? ' per plot' : ''}`;
      return `<button class="tool ${c.tool === k ? 'on' : ''}" data-tool="${k}" title="${esc(k === 'erase' ? 'Click something that has not been started to remove it.' : b.desc)}" aria-pressed="${c.tool === k}"><strong>${esc(label)}</strong><span>${esc(cost)}</span></button>`;
    }).join('');
    return `<div class="tools">${tools}</div><p class="hint">${esc(c.tool === 'erase' ? 'Click something that has not been started to remove it.' : B[c.tool].desc)}</p>`;
  }

  function planTotals() {
    const c = G().colony;
    let labor = 0, timber = 0;
    const counts = {};
    for (const it of c.items) {
      labor += it.labor * (1 - (it.progress || 0));
      timber += it.timber * (1 - (it.progress || 0));
      counts[it.type] = (counts[it.type] || 0) + 1;
    }
    return { labor: Math.round(labor), timber: Math.round(timber), counts };
  }

  LF.panels.plan = {
    html() {
      const g = G(), c = g.colony;
      const t = planTotals();
      const pop = LF.settlersAboard() + g.crew.filter((m) => m.alive).length;
      const beds = (t.counts.house || 0) * 8;
      const list = Object.entries(t.counts).map(([k, n]) => `<li>${esc(B[k].name)}${n > 1 ? ` × ${n}` : ''}</li>`).join('') || '<li class="muted">Nothing planned yet.</li>';
      const workers = pop - 5;
      const weeks = Math.round(t.labor / Math.max(1, workers * 0.6) / 7);
      return `
        <h2>The town plan</h2>
        <p class="lede">Drawn on the chart of ${esc(c.site.name)}. About ${pop} people will land. Plan for shelter before winter and fields planted by the middle of June.</p>
        <div class="actions"><button class="btn" id="b-auto">Let Fenwick draft a plan</button><button class="btn ghost" id="b-clear">Clear the plan</button></div>
        <h3>Build</h3>
        ${toolbox()}
        <h3>So far</h3>
        <ul class="plist">${list}</ul>
        <dl class="facts">
          <dt>Beds</dt><dd class="${beds >= pop ? 'good' : 'bad'}">${beds} for ${pop} people</dd>
          <dt>Fields</dt><dd>${t.counts.field || 0}, about ${(t.counts.field || 0) * 10} acres</dd>
          <dt>Work</dt><dd>About ${t.labor.toLocaleString('en-US')} person-days. With most hands on it, ${weeks <= 1 ? 'a week or so' : `about ${weeks} weeks`}.</dd>
          <dt>Timber</dt><dd>${t.timber} loads needed${g.timber ? `, ${Math.floor(g.timber)} already cut at the landing` : ''}</dd>
        </dl>
        <div class="actions"><button class="btn primary" id="b-ashore">Sail for ${esc(c.site.name)} and go ashore</button></div>
        <p class="hint">Scroll to zoom and drag with Shift held to pan the map.</p>`;
    },
    wire() {
      const c = G().colony;
      document.querySelectorAll('.tool').forEach((b) => (b.onclick = () => { c.tool = b.dataset.tool; LF.render(); }));
      $('#b-auto').onclick = autoPlan;
      $('#b-clear').onclick = () => { c.items = []; LF.render(); };
      $('#b-ashore').onclick = () => {
        if (!c.items.length) return LF.showModal({ title: 'No plan?', body: '<p>You have not planned anything. The settlers will land and start from nothing.</p>', buttons: [{ label: 'Go ashore anyway', primary: true, act: goAshore }, { label: 'Back to the plan' }] });
        goAshore();
      };
    },
  };
  LF.keys.plan = LF.keys.colony = (ev) => {
    if (ev.key === 'Escape') { G().colony.tool = 'erase'; LF.render(); }
  };

  // ---------------------------------------------------------------- going ashore

  function goAshore() {
    const g = G(), c = g.colony, w = g.world;
    const site = c.site;
    c.Ltrue = LF.buildLocal({ t: w.t, river: w.river, feat: w.feat }, c.cx, c.cy, true, g.seed);
    const sail = 1 + Math.round(Math.hypot(site.x - w.camp.x, site.y - w.camp.y) / 14);
    for (let k = 0; k < sail; k++) { g.day++; g.hold = Math.max(0, g.hold - LF.settlersAboard()); if (g.day > LF.DEADLINE) g.lateDays++; }
    c.landDay = g.day;
    c.day = g.day;

    // Check the plan against the ground.
    const problems = [];
    for (const it of c.items) {
      const why = problem(c.Ltrue, it, false);
      const before = it.labor;
      it.labor = laborFor(c.Ltrue, it);
      if (why) { it.blocked = true; it.reason = why; problems.push({ it, why }); }
      else if (it.type === 'field' && it.labor > before * 1.8) problems.push({ it, why: 'Woods, not open ground. It will have to be cleared first.', soft: true });
    }
    if (c.items.some((it) => it.type === 'well')) {
      for (const it of c.items.filter((x) => x.type === 'well' && !x.blocked)) {
        const k = c.Ltrue.t[it.y * N + it.x];
        if (k === T.BEACH || nearSalt(c.Ltrue, it.x, it.y)) { it.brackish = true; problems.push({ it, why: 'Too close to salt water. The well will come up brackish.', soft: true }); }
        else if (LF.isHigh(k)) { it.deep = true; it.labor *= 2; problems.push({ it, why: 'High ground. The well will have to go deep.', soft: true }); }
      }
    }

    // People.
    const people = [];
    for (const m of g.crew) if (m.alive) people.push({ name: m.name, role: m.role, crewId: m.id, health: m.health, sick: false, alive: true, traits: m.traits });
    for (const [k, a] of Object.entries(LF.ADVISORS)) people.push({ name: a.name, role: a.role, officer: k, health: 3, sick: false, alive: true, traits: [] });
    for (const [name, role] of LF.SETTLER_NAMES) people.push({ name, role, health: 3, sick: false, alive: true, traits: [] });
    const scurvy = Math.round(g.lateDays * 0.4);
    for (let k = 0; k < scurvy; k++) { const p = LF.pick(people.filter((x) => !x.crewId && x.health > 1)); if (p) { p.health--; p.sick = true; } }
    c.people = people;

    c.food = Math.floor(g.hold + g.stores.rations);
    const coastal = LF.harborShelter(w.t, site.x, site.y).coastal;
    c.timber = Math.floor(g.timber * (coastal ? 0.9 : 0.4));
    c.pelts = 0;
    c.tobacco = 0;
    c.tools = g.stores.tools;
    c.cloth = g.stores.cloth;
    c.beads = g.stores.beads;
    c.powder = g.stores.powder;
    c.medicine = g.stores.medicine;
    c.morale = 60;
    c.taught = false;
    c.harvested = false;
    c.tobaccoFields = 0;
    c.turn = 0;
    c.flags = {};
    c.phase = 'colony';
    c.tool = 'house';
    c.jobs = { build: 0, farm: 0, timber: 0, hunt: 0, fish: 0, gather: 0, trade: 0, guard: 0, nurse: 0 };
    c.env = environment(c);
    c.autoWork = true;
    c.timber += 60;
    autoJobs(c);

    // What the neighbors make of where you landed.
    const notes = neighborReaction(c);

    g.mode = 'colony';
    LF.resetCams();
    LF.render();
    const lines = problems.filter((p) => !p.soft).length ? `<p><strong>The ground does not match the plan.</strong></p><ul class="night">${summarize(problems.filter((p) => !p.soft))}</ul>` : '<p>Every building in the plan stands on ground that will take it.</p>';
    const soft = problems.filter((p) => p.soft);
    const drift = site.tx !== undefined && (site.tx !== site.x || site.ty !== site.y) ? `<p>Standing on the beach, ${esc(site.by.split(' ')[0])} looks around and goes pale. The survey stake is not here. It stands ${LF.miles(Math.hypot(site.tx - site.x, site.ty - site.y))} to the ${LF.bearing(site.tx - site.x, site.ty - site.y)}. The party’s reckoning had drifted, and the plan was drawn on the wrong piece of ground.</p>` : '';
    LF.journal(`Went ashore at ${site.name}.`);
    chron(`The settlers went ashore at ${site.name} on the ${LF.dateOf(g.day).name}.`);
    LF.showModal({
      title: 'Ashore',
      eyebrow: `${site.name}, ${LF.dateOf(g.day).name}`,
      wide: true,
      body: `<p>The boats run up on the ${coastal ? 'beach' : 'riverbank'} and ${c.people.length} people climb out onto solid ground for the first time in fifteen weeks. Now you can see the land as it is.</p>${drift}${lines}${soft.length ? `<ul class="night">${summarize(soft)}</ul>` : ''}${notes}<p class="muted">Blocked items are crossed out in red. Remove them and place them somewhere else. The <em>Constant</em> sails for home in the morning. The supply ship is due next May.</p>`,
      buttons: [{ label: 'Begin', primary: true }],
    });
  }

  function summarize(list) {
    const groups = new Map();
    for (const { it, why } of list) {
      const key = B[it.type].name + '|' + why;
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    return [...groups.entries()].map(([k, n]) => { const [name, why] = k.split('|'); return `<li><strong>${esc(name)}${n > 1 ? ` × ${n}` : ''}:</strong> ${esc(why)}</li>`; }).join('');
  }
  function nearSalt(L, x, y) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (LF.localIn(xx, yy)) { const k = L.t[yy * N + xx]; if (k === T.SEA || k === T.DEEP || k === T.SALTMARSH) return true; }
    }
    return false;
  }

  // Facts about the true ground that drive the simulation.
  function environment(c) {
    const g = G(), w = g.world, L = c.Ltrue;
    const mid = N / 2;
    let wet = 0, woods = 0, water = false, open = 0;
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const i = y * N + x, k = L.t[i];
        const d = Math.hypot(x - mid, y - mid);
        if (d <= 14 && LF.isWet(k)) wet++;
        if (d <= 18 && LF.isWoods(k)) woods++;
        if (d <= 12 && LF.isOpen(k)) open++;
        if (d <= 7 && (L.river[i] || k === T.LAKE)) water = true;
      }
    let game = 0, beaver = 0, saltlick = false, berries = false, clay = false, iron = false;
    LF.around(c.cx, c.cy, 7, (x, y, d, j) => {
      if (w.game[j]) game++;
      if (w.feat[j] === F.BEAVER) beaver++;
      if (w.feat[j] === F.SALTLICK) saltlick = true;
      if (w.feat[j] === F.BERRIES) berries = true;
      if (w.feat[j] === F.IRON) iron = true;
      if (w.feat[j] === F.SPRING && d <= 3) water = true;
    });
    const hb = LF.harborShelter(w.t, c.cx, c.cy);
    let riverNear = false, lakeNear = false;
    LF.around(c.cx, c.cy, 3, (x, y, d, j) => { if (w.river[j]) riverNear = true; if (w.t[j] === T.LAKE) lakeNear = true; });
    const onHill = LF.isHigh(w.t[idx(c.cx, c.cy)]) || w.feat[idx(c.cx, c.cy)] === F.CLIFF;
    return {
      wet, woods, open, water, game, beaver, saltlick, berries, iron, onHill,
      coastal: hb.coastal, shelter: hb.shelter,
      fishWater: hb.coastal ? 1.2 : riverNear ? 0.9 : lakeNear ? 0.8 : 0,
      forest: clamp(woods / 260, 0.25, 1.2),
      gameF: clamp(game / 22 + (saltlick ? 0.3 : 0), 0.3, 1.7),
      beaverF: clamp(beaver * 0.6 + game / 40, 0.1, 2.5),
    };
  }

  function neighborReaction(c) {
    const g = G();
    const out = [];
    for (const v of g.world.villages) {
      const d = Math.hypot(v.x - c.cx, v.y - c.cy);
      if (d <= v.radius + 0.5) {
        if (v.promised) {
          v.promiseBroken = true;
          v.relation = -3;
          v.memory.push('The strangers broke their word and built on our hunting grounds.');
          out.push(`<p class="bad">You have built inside the hunting grounds of ${esc(v.name)}, after promising not to. They will not forgive it.</p>`);
        } else if (v.contacted) {
          v.relation = Math.max(-3, v.relation - 1.5);
          v.memory.push('The strangers built on our hunting grounds.');
          out.push(`<p class="bad">The town sits inside the hunting grounds of ${esc(v.name)}. They are angry.</p>`);
        } else {
          v.relation = -1;
          v.memory.push('Strangers came and built on our hunting grounds without asking.');
        }
      }
    }
    let burial = false;
    LF.around(c.cx, c.cy, 2.5, (x, y, d, j) => { if (g.world.feat[j] === F.BURIAL) burial = true; });
    if (burial) {
      const v = g.world.villages.reduce((b, v) => (!b || Math.hypot(v.x - c.cx, v.y - c.cy) < Math.hypot(b.x - c.cx, b.y - c.cy) ? v : b), null);
      v.relation = Math.max(-3, v.relation - 1.5);
      v.memory.push('The strangers built beside our dead.');
      out.push(`<p class="bad">There is a burial ground within sight of the town. When ${esc(v.name)} learn of it they will take it hard.</p>`);
      c.burial = true;
    }
    return out.join('');
  }

  // ---------------------------------------------------------------- people and jobs

  const alivePeople = () => G().colony.people.filter((p) => p.alive);
  const workers = () => alivePeople().filter((p) => !p.sick);
  const hasCrew = (id) => G().colony.people.some((p) => p.alive && p.crewId === id);

  const JOBS = {
    build: { name: 'Build', desc: 'Work through the building list in order.' },
    farm: { name: 'Farm', desc: 'Tend the crops. Each planted field wants about half a worker.' },
    timber: { name: 'Cut timber', desc: 'For building, firewood and export.' },
    hunt: { name: 'Hunt and trap', desc: 'Meat and pelts. Uses powder.' },
    fish: { name: 'Fish', desc: 'Best in spring when the fish run.' },
    gather: { name: 'Gather', desc: 'Berries, nuts, greens, shellfish. Summer and fall.' },
    trade: { name: 'Trade', desc: 'Carry goods to friendly towns for corn and furs.' },
    guard: { name: 'Stand guard', desc: 'Defense against raids.' },
    nurse: { name: 'Nurse the sick', desc: 'Each nurse can look after about five.' },
  };

  // Harrow's allocation: what a sensible quartermaster would do this fortnight.
  function autoJobs(c) {
    const g = G(), w = g.world;
    const n = workers().length;
    const j = c.jobs;
    for (const k of Object.keys(j)) j[k] = 0;
    if (!n) return;
    const season = LF.season(c.day);
    const pop = alivePeople().length;
    const sick = alivePeople().filter((p) => p.sick).length;
    let left = n;
    const give = (k, v) => { const x = Math.max(0, Math.min(left, Math.round(v))); j[k] += x; left -= x; };
    give('nurse', Math.ceil(Math.max(0, sick - (hasCrew('colby') ? 8 : 0)) / 5));
    const hostile = w.villages.some((v) => v.relation < 0 && Math.hypot(v.x - c.cx, v.y - c.cy) < 20);
    give('guard', hostile ? 4 : 1);
    const growing = c.items.filter((i) => i.type === 'field' && i.plantedDay && !c.harvested).length;
    if (growing && c.day < HARVEST_DAY + TURN) give('farm', growing * 0.55);
    let needTimber = 0, needLabor = 0;
    for (const it of c.items) if (!it.blocked && it.progress < 1) { needTimber += it.timber * (1 - it.progress); needLabor += it.labor * (1 - it.progress); }
    const winterWood = !isWinter(c.day) && LF.dateOf(c.day).month >= 8 ? pop * 2 * 6 : isWinter(c.day) ? pop * 2 * 2 : 0;
    const woodGap = Math.max(0, needTimber + winterWood - c.timber);
    const perCutter = TURN * 1.5 * c.env.forest;
    give('timber', Math.min(n * 0.35, woodGap / perCutter));
    const days = foodProjection(c);
    const hungry = days < 60;
    if (c.env.fishWater) give('fish', n * (LF.dateOf(c.day).month >= 3 && LF.dateOf(c.day).month <= 4 ? 0.3 : hungry ? 0.25 : 0.15));
    give('hunt', n * (c.powder > 0 ? (season === 'autumn' ? 0.15 : 0.1) : 0.06));
    const partners = w.villages.some((v) => v.contacted && v.relation >= 0 && Math.hypot(v.x - c.cx, v.y - c.cy) <= 26);
    if (partners && c.tools + c.cloth + c.beads > 0 && hungry) give('trade', 2);
    if (needLabor > 0) give('build', Math.min(left, needLabor / (TURN * 0.9)));
    if (season === 'summer' || season === 'autumn') give('gather', left);
    else give('build', left);
    if (left) give('timber', left);
  }
  LF.autoJobs = autoJobs;

  function balanceJobs(c) {
    const n = workers().length;
    let tot = Object.values(c.jobs).reduce((a, b) => a + b, 0);
    const order = ['gather', 'trade', 'timber', 'fish', 'hunt', 'guard', 'farm', 'build', 'nurse'];
    let k = 0;
    while (tot > n && k < 200) {
      const job = order[k % order.length];
      if (c.jobs[job] > 0) { c.jobs[job]--; tot--; }
      k++;
    }
  }

  // ---------------------------------------------------------------- the season

  const chron = (text) => G().colony.chronicle.push({ day: G().colony.day, text });
  const clog = (text) => G().colony.log.push({ day: G().colony.day, text });

  function monthOf(day) { return LF.dateOf(day).month; }
  function isWinter(day) { const m = monthOf(day); return m === 11 || m <= 2; }

  function soil(k) {
    return { [T.OLDFIELD]: 1.15, [T.MEADOW]: 1.0, [T.FOREST]: 0.9, [T.PINE]: 0.5, [T.HILLS]: 0.7, [T.BEACH]: 0.4, [T.MOUNTAIN]: 0.3 }[k] || 0.6;
  }
  function riverside(L, x, y) {
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (LF.localIn(x + dx, y + dy) && L.river[(y + dy) * N + x + dx]) return true;
    return false;
  }
  function done(type) { return G().colony.items.filter((i) => i.type === type && i.progress >= 1 && !i.blocked); }
  // Clean water within about a mile of where people actually live, or a good well.
  function goodWater(c) {
    if (done('well').some((w) => !w.brackish)) return true;
    const homes = c.items.filter((i) => (i.type === 'house' || i.type === 'storehouse') && !i.blocked);
    const L = c.Ltrue;
    const pts = homes.length ? homes.map((h) => [h.x, h.y]) : [[N / 2, N / 2]];
    for (const [hx, hy] of pts)
      for (let dy = -8; dy <= 8; dy++)
        for (let dx = -8; dx <= 8; dx++) {
          const x = hx + dx, y = hy + dy;
          if (!LF.localIn(x, y) || dx * dx + dy * dy > 64) continue;
          const i = y * N + x;
          if (L.river[i] || L.t[i] === T.LAKE || L.feat.get(i) === F.SPRING) return true;
        }
    return false;
  }
  function beds(c) {
    return done('house').length * 8 + (done('meetinghouse').length ? 6 : 0) + (done('blockhouse').length ? 4 : 0);
  }
  function defense(c) {
    const pal = c.items.find((i) => i.type === 'palisade' && !i.blocked);
    let d = c.jobs.guard * 1.5 + (pal ? pal.progress * 10 : 0) + done('blockhouse').length * 8 + (c.env.onHill ? 3 : 0);
    d += c.people.filter((p) => p.alive && !p.sick && p.role === 'Soldier').length * 2;
    if (G().advisors.quarles.loyalty < 30) d *= 0.75;
    return Math.round(d);
  }

  function foodProjection(c) {
    const pop = alivePeople().length;
    return Math.floor(c.food / Math.max(1, pop));
  }

  function turn() {
    const g = G(), c = g.colony, w = g.world;
    const days = TURN;
    const report = [];
    const R = Math.random;
    if (c.autoWork) autoJobs(c);
    balanceJobs(c);
    const J = c.jobs;
    const pop = alivePeople().length;
    const season = LF.season(c.day);
    const month = monthOf(c.day);
    let mf = 0.7 + c.morale / 200;
    if (g.advisors.kemp.loyalty < 30) mf *= 0.9;

    // Building.
    const carp = c.people.filter((p) => p.alive && !p.sick && (p.role === 'Carpenter' || (p.traits || []).includes('builder'))).length;
    let labor = J.build * days * mf * (1 + Math.min(0.4, carp * 0.08));
    const built = [];
    for (const it of c.items) {
      if (labor <= 0) break;
      if (it.progress >= 1 || it.blocked) continue;
      const needL = it.labor * (1 - it.progress);
      const needT = it.timber * (1 - it.progress);
      let frac = Math.min(1, labor / needL);
      if (needT > 0) frac = Math.min(frac, c.timber / needT);
      if (frac <= 0) { if (needT > 0 && c.timber < 1) { report.push('Building stopped for want of timber.'); } break; }
      labor -= needL * frac;
      c.timber -= needT * frac;
      it.progress = Math.min(1, it.progress + (1 - it.progress) * frac);
      if (it.progress >= 0.999) {
        it.progress = 1;
        built.push(it);
        if (it.type === 'field') it.plantedDay = c.day + days <= 112 ? c.day + days : null;
      }
    }
    const bset = {};
    for (const b of built) bset[b.type] = (bset[b.type] || 0) + 1;
    if (built.length) report.push(`Finished: ${listJoin(Object.entries(bset).map(([k, n]) => (n > 1 ? `${n} ${B[k].name.toLowerCase()}s` : `a ${B[k].name.toLowerCase()}`)))}.`);
    const lateFields = built.filter((b) => b.type === 'field' && !b.plantedDay).length;
    if (lateFields) report.push(`${Num(lateFields)} field${lateFields > 1 ? 's were' : ' was'} cleared too late to plant this year.`);
    // Tobacco on the first N planted fields.
    const planted = c.items.filter((i) => i.type === 'field' && i.plantedDay && !i.blocked);
    planted.forEach((f, k) => (f.crop = k < c.tobaccoFields ? 'tobacco' : 'corn'));

    // Farming.
    const growing = planted.filter(() => !c.harvested && c.day < HARVEST_DAY);
    if (growing.length) {
      const need = growing.length * 0.5;
      const ratio = Math.min(1, J.farm / need);
      c.tendSum = (c.tendSum || 0) + ratio;
      c.tendTurns = (c.tendTurns || 0) + 1;
      if (ratio < 0.6) report.push('The fields are going to weeds. They need more hands.');
    }
    let fresh = 0;
    let food = 0;
    if (!c.harvested && c.day + days >= HARVEST_DAY) {
      c.harvested = true;
      const tend = c.tendTurns ? c.tendSum / c.tendTurns : 0.5;
      const hands = Math.min(1, (J.farm + J.gather * 0.5) / Math.max(1, planted.length * 0.4));
      let corn = 0, tob = 0;
      for (const f of planted) {
        const k = c.Ltrue.t[f.y * N + f.x];
        const timing = clamp((112 - f.plantedDay) / 52, 0.15, 1);
        const y = soil(k) * (riverside(c.Ltrue, f.x, f.y) ? 1.15 : 1) * timing * (0.5 + tend * 0.5) * (0.85 + R() * 0.3) * (0.6 + hands * 0.4);
        if (f.crop === 'tobacco') tob += 380 * y;
        else corn += 720 * y * (c.taught ? 1.3 : 1);
      }
      if (c.flags.hurricaneFields) corn *= 0.7;
      corn = Math.round(corn);
      tob = Math.round(tob);
      food += corn;
      c.tobacco += tob;
      c.harvestTotal = corn;
      report.push(`<strong>Harvest.</strong> ${corn.toLocaleString('en-US')} rations of corn and beans came in${tob ? `, and ${tob.toLocaleString('en-US')} pounds of tobacco for export` : ''}.`);
      chron(`The harvest brought in ${corn.toLocaleString('en-US')} rations of corn${tob ? ` and ${tob.toLocaleString('en-US')} pounds of tobacco` : ''}.`);
      for (const f of planted) f.harvested = true;
    }

    // Timber.
    const saw = done('sawpit').length ? 1.4 : 1;
    const cut = J.timber * days * 1.5 * c.env.forest * mf * saw;
    c.timber += cut;

    // Hunting.
    const huntSeason = { spring: 0.9, summer: 1, autumn: 1.3, winter: 0.7 }[season];
    const powderUse = Math.min(c.powder, (J.hunt * days) / 25);
    const pb = c.powder > 0 ? 1.3 : 1;
    c.powder = Math.max(0, c.powder - powderUse);
    const meat = J.hunt * days * 1.5 * c.env.gameF * huntSeason * pb * mf;
    const pelts = J.hunt * days * 0.05 * c.env.beaverF * (season === 'winter' || season === 'autumn' ? 1.4 : 0.8);
    c.pelts += pelts;
    food += meat;
    fresh += meat;

    // Fishing.
    const fishSeason = month >= 3 && month <= 4 ? 1.8 : month >= 5 && month <= 8 ? 1 : month >= 9 && month <= 10 ? 0.8 : 0.35;
    const fish = J.fish * days * 2.3 * c.env.fishWater * fishSeason * (done('dock').length ? 1.35 : 1) * mf;
    food += fish;
    fresh += fish;

    // Gathering.
    const gs = { spring: 0.5, summer: 1.2, autumn: 1, winter: 0.1 }[season] * (c.env.berries ? 1.3 : 1);
    const gathered = J.gather * days * 1 * gs * mf;
    food += gathered;
    fresh += gathered;

    // Trade.
    const partners = w.villages.filter((v) => v.contacted && v.relation >= 0 && Math.hypot(v.x - c.cx, v.y - c.cy) <= 26);
    if (J.trade && partners.length) {
      let cap = J.trade * days * 0.25 * (done('tradehouse').length ? 1.5 : 1);
      let got = 0, furs = 0;
      for (const [k, val] of [['cloth', 9], ['tools', 13], ['beads', 3]]) {
        while (cap >= 1 && c[k] >= 1) {
          c[k]--;
          cap--;
          const partner = LF.pick(partners);
          if (partner.economy === 'furs' && R() < 0.5) furs += val / 5;
          else got += val * (partner.relation >= 1 ? 1.2 : 1);
          partner.relation = Math.min(3, partner.relation + 0.05);
        }
      }
      food += got;
      c.pelts += furs;
      if (got || furs) report.push(`Traders brought back ${Math.round(got)} rations of corn${furs ? ` and ${Math.round(furs)} pelts` : ''}.`);
      else report.push('The traders had nothing left to trade.');
    } else if (J.trade) report.push('There is no friendly town to trade with.');

    // Eating and spoilage.
    c.food += food;
    const eaten = pop * days;
    c.food -= eaten;
    const spoil = done('storehouse').length ? 0.01 : 0.06;
    const hSpoil = g.advisors.harrow.loyalty < 30 ? 0.03 : 0;
    if (c.food > 0) {
      const lost = Math.round(c.food * (spoil + hSpoil));
      c.food -= lost;
      if (!done('storehouse').length && lost > 40) report.push(`${lost} rations spoiled with no storehouse to keep them dry.`);
    }

    // Firewood.
    let fireShort = 0;
    if (isWinter(c.day)) {
      const need = pop * 2;
      if (c.timber >= need) c.timber -= need;
      else { fireShort = 1 - c.timber / need; c.timber = 0; report.push('Not enough firewood. People are burning fence rails.'); }
    }

    // Sickness.
    const housed = beds(c);
    const unhousedShare = Math.max(0, (pop - housed) / Math.max(1, pop));
    const water = goodWater(c);
    let pSick = 0;
    if (month >= 6 && month <= 8) pSick += Math.min(0.16, 0.0025 * c.env.wet);
    pSick += water ? 0.004 : 0.05;
    if (isWinter(c.day)) pSick += unhousedShare * 0.16 + 0.025 * (done('kiln').length ? 0.5 : 1) + fireShort * 0.08;
    if (month >= 1 && month <= 3 && fresh < pop * days * 0.3) pSick += 0.05;
    if (c.food < 0) {
      for (const p of alivePeople()) p.health--;
      report.push('<strong>The food has run out.</strong> Everyone is starving.');
      c.food = 0;
      c.morale -= 12;
    }
    let newlySick = 0;
    for (const p of alivePeople()) {
      if (!p.sick && R() < pSick) { p.sick = true; newlySick++; }
    }
    const sick = alivePeople().filter((p) => p.sick);
    const nurseCap = J.nurse * 5 + (hasCrew('colby') ? 8 : 0);
    const cover = sick.length ? Math.min(1, nurseCap / sick.length) : 1;
    let medUsed = 0;
    for (const p of sick) {
      p.health--;
      let rec = 0.35 + cover * 0.35;
      if (c.medicine > 0 && medUsed < 6) { c.medicine--; medUsed++; rec += 0.15; }
      if (p.health > 0 && R() < rec) { p.sick = false; }
    }
    for (const p of alivePeople()) if (!p.sick && p.health < 3 && R() < 0.5) p.health++;
    if (newlySick) {
      const cause = month >= 6 && month <= 8 && c.env.wet > 8 ? 'fever' : !water ? 'the flux' : isWinter(c.day) ? 'winter sickness' : 'sickness';
      report.push(`${Num(newlySick)} ${newlySick > 1 ? 'people' : 'person'} came down with ${cause}.`);
      c.lastCause = cause;
    }

    // Raids.
    for (const v of w.villages) {
      const hostility = (v.relation < 0 ? -v.relation : 0) + (v.promiseBroken ? 2 : 0) + (c.burial && v === nearestVillage(c) ? 1 : 0);
      if (!hostility) continue;
      const d = Math.hypot(v.x - c.cx, v.y - c.cy);
      const chance = 0.05 * hostility * (d < 16 ? 1 : 0.5) * (season === 'winter' ? 0.4 : 1);
      if (R() < chance) {
        const strength = 8 + hostility * 4 + R() * 10 + v.size / 60;
        const def = defense(c);
        if (def >= strength) {
          report.push(`<strong>A raid from ${esc(v.name)} was beaten off.</strong> The ${def >= strength * 1.5 ? 'guards saw them coming' : 'fighting was close'}.`);
          chron(`Warriors from ${v.name} attacked and were driven off.`);
          c.morale += 2;
        } else {
          const n = 1 + Math.floor(R() * 3);
          const victims = LF.shuffle(workers()).slice(0, n);
          for (const p of victims) kill(p, `killed in a raid by ${v.name}`);
          const lostFood = Math.round(c.food * 0.15);
          c.food -= lostFood;
          const target = LF.shuffle(c.items.filter((i) => i.progress >= 1 && i.type !== 'field' && i.type !== 'palisade'))[0];
          if (target) target.progress = 0.4;
          report.push(`<strong>Raiders from ${esc(v.name)} struck the town.</strong> ${listJoin(victims.map((p) => p.name))} ${victims.length > 1 ? 'were' : 'was'} killed. ${lostFood} rations taken${target ? `, and a ${B[target.type].name.toLowerCase()} burned` : ''}.`);
          chron(`Raiders from ${v.name} killed ${listJoin(victims.map((p) => p.name))}.`);
          c.morale -= 10;
        }
      }
    }

    // Deaths.
    const dead = [];
    for (const p of alivePeople()) if (p.health <= 0) { kill(p, p.sick ? c.lastCause || 'sickness' : 'hunger'); dead.push(p); }
    if (dead.length) report.push(`<strong>Died:</strong> ${esc(listJoin(dead.map((p) => p.name)))}.`);

    // Morale.
    let dm = (55 - c.morale) * 0.1;
    const fd = foodProjection(c);
    if (fd > 90) dm += 3; else if (fd < 20) dm -= 8;
    dm -= dead.length * 3;
    if (done('meetinghouse').length) dm += 3;
    if (isWinter(c.day) && unhousedShare > 0.2) dm -= 6;
    if (g.advisors.pryce.loyalty < 30) dm -= 2;
    c.morale = clamp(c.morale + dm, 0, 100);

    c.day += days;
    c.turn++;
    g.day = c.day;
    const ev = colonyEvent(c);
    for (const r of report) clog(r.replace(/<[^>]+>/g, ''));
    return { report, ev };
  }

  function nearestVillage(c) {
    return G().world.villages.reduce((b, v) => (!b || Math.hypot(v.x - c.cx, v.y - c.cy) < Math.hypot(b.x - c.cx, b.y - c.cy) ? v : b), null);
  }

  function kill(p, cause) {
    const c = G().colony;
    if (!p.alive) return;
    p.alive = false;
    p.sick = false;
    c.deaths.push({ name: p.name, role: p.role, cause, day: c.day, crewId: p.crewId, officer: p.officer });
    if (p.crewId) { const m = LF.crewById(p.crewId); if (m) m.alive = false; }
    c.morale -= 2;
  }

  // ---------------------------------------------------------------- colony events

  const EVENTS = [
    {
      id: 'teach', once: true,
      ok: (c) => c.day < 95 && G().world.villages.some((v) => v.relation >= 1 && Math.hypot(v.x - c.cx, v.y - c.cy) < 24),
      run: (c) => {
        const v = G().world.villages.find((v) => v.relation >= 1 && Math.hypot(v.x - c.cx, v.y - c.cy) < 24);
        return {
          title: 'Visitors in the fields',
          body: `<p>Several women from ${esc(v.name)} have come to watch the settlers plant. They are laughing. One kneels, digs a hill, drops in a fish and four kernels of corn, and shows where the beans and squash go.</p>`,
          buttons: [
            { label: 'Ask them to teach everyone', primary: true, act: () => { c.taught = true; v.relation = Math.min(3, v.relation + 0.5); chron(`Women from ${v.name} taught the settlers to plant corn, beans and squash together.`); } },
            { label: 'Thank them and carry on the English way', act: () => { clog('Declined to learn native planting.'); } },
          ],
        };
      },
    },
    {
      id: 'tribute',
      ok: (c) => G().world.villages.some((v) => v.contacted && v.relation <= 0 && v.relation > -3 && Math.hypot(v.x - c.cx, v.y - c.cy) < 20) && c.tools >= 2,
      run: (c) => {
        const v = G().world.villages.find((v) => v.contacted && v.relation <= 0 && v.relation > -3 && Math.hypot(v.x - c.cx, v.y - c.cy) < 20);
        return {
          title: 'A demand',
          body: `<p>Men from ${esc(v.name)} arrive at the edge of the town. You are on land they hunt. They want payment: iron hatchets, and a promise that the settlers will not cut the woods to the north.</p>`,
          buttons: [
            { label: 'Pay three bundles of tools', primary: true, act: () => { c.tools -= 3; v.relation = Math.min(3, v.relation + 1.2); v.memory.push('The strangers paid for the land they use.'); chron(`Paid ${v.name} in iron tools for the use of their land.`); } },
            { label: 'Refuse', act: () => { v.relation = Math.max(-3, v.relation - 1); v.memory.push('The strangers refused to pay for our land.'); chron(`Refused a demand for payment from ${v.name}.`); } },
          ],
        };
      },
    },
    {
      id: 'fire',
      ok: (c) => isWinter(c.day) && done('house').length >= 2,
      run: (c) => ({
        title: 'Fire',
        body: '<p>A chimney of sticks and clay has caught. The roof of one of the houses is burning, and the wind is blowing sparks toward the next.</p>',
        buttons: [
          { label: 'Everyone to the fire', primary: true, act: () => {
            if (Math.random() < 0.7) { clog('Put out a house fire.'); }
            else { const h = done('house')[0]; h.progress = 0.3; clog('A house burned down.'); chron('A house burned down in the middle of winter.'); }
            const p = LF.pick(workers()); if (p) p.health--;
          } },
          { label: 'Save the neighboring houses and let it burn', act: () => { const h = done('house')[0]; h.progress = 0.3; chron('A house burned down in the middle of winter.'); } },
        ],
      }),
    },
    {
      id: 'birth', once: false,
      ok: (c) => c.turn > 3 && Math.random() < 0.4,
      run: (c) => {
        const names = ['Hope', 'Peregrine', 'Faith', 'Oceanus', 'Constance', 'Increase', 'Patience', 'Remember'];
        const nm = LF.pick(names.filter((n) => !c.people.some((p) => p.name.startsWith(n))));
        if (!nm) return null;
        const parent = LF.pick(c.people.filter((p) => p.alive && !p.crewId && !p.officer));
        const surname = parent ? parent.name.split(' ').slice(-1)[0] : 'Cole';
        c.people.push({ name: `${nm} ${surname}`, role: 'Child', child: true, health: 2, sick: false, alive: true, traits: [] });
        c.morale = Math.min(100, c.morale + 6);
        chron(`${nm} ${surname} was born, the first child of the colony${c.flags.born ? '' : ''}.`);
        c.flags.born = true;
        return { title: 'A birth', body: `<p>A child was born in the night: ${esc(nm)} ${esc(surname)}. Mother and child are well. Pryce holds a service, and for a day nobody talks about anything else.</p>` };
      },
    },
    {
      id: 'feast', once: true,
      ok: (c) => c.harvested && (c.harvestTotal || 0) > 3000,
      run: (c) => {
        const friend = G().world.villages.find((v) => v.relation >= 1 && Math.hypot(v.x - c.cx, v.y - c.cy) < 24);
        return {
          title: 'The harvest is in',
          body: `<p>The corn is in the storehouse. Kemp asks for a day of thanksgiving and a feast.${friend ? ` Rowe suggests inviting ${esc(friend.name)}.` : ''}</p>`,
          buttons: [
            { label: friend ? 'Hold a feast and invite the neighbors' : 'Hold a feast', primary: true, act: () => { const cost = alivePeople().length * 3 + (friend ? 120 : 0); c.food -= cost; c.morale = Math.min(100, c.morale + 15); if (friend) { friend.relation = Math.min(3, friend.relation + 1); friend.memory.push('The strangers feasted with us after their harvest.'); } chron(`The colony held a harvest feast${friend ? ` with ${friend.name}` : ''}.`); } },
            { label: 'Save the food for winter', act: () => { c.morale -= 4; } },
          ],
        };
      },
    },
    {
      id: 'deserters',
      ok: (c) => c.morale < 30 && alivePeople().length > 20,
      run: (c) => ({
        title: 'Deserters',
        body: '<p>Four settlers come to you at night. They have heard there are English fishing stations up the coast. They want to take a boat and go.</p>',
        buttons: [
          { label: 'Let them go', act: () => { const ps = LF.shuffle(c.people.filter((p) => p.alive && !p.crewId && !p.officer && !p.child)).slice(0, 4); for (const p of ps) { p.alive = false; c.deaths.push({ name: p.name, cause: 'left for the fishing stations', day: c.day, deserted: true }); } c.morale += 5; chron('Four settlers left for the fishing stations up the coast.'); } },
          { label: 'Forbid it', act: () => { c.morale -= 8; } },
          { label: 'Ask Pryce to speak to them', primary: true, act: () => { if (G().advisors.pryce.loyalty >= 50) { c.morale += 10; clog('Pryce talked the deserters round.'); } else { c.morale -= 5; clog('Pryce would not help.'); } } },
        ],
      }),
    },
    {
      id: 'voss', once: true,
      ok: (c) => G().advisors.voss.loyalty < 35 && c.pelts > 20,
      run: (c) => ({
        title: 'Missing pelts',
        body: '<p>Harrow reports that the pelt count in the storehouse does not match his book. Someone has been setting furs aside. Voss has a locked chest in his house.</p>',
        buttons: [
          { label: 'Open the chest', primary: true, act: () => { G().advisors.voss.loyalty -= 20; clog('Found the missing pelts in Voss’s chest.'); chron('Voss was caught hoarding pelts for his own account.'); } },
          { label: 'Let it go', act: () => { c.pelts *= 0.7; } },
        ],
      }),
    },
    {
      id: 'sail', once: true,
      ok: (c) => c.env.coastal && c.turn >= 2 && c.turn <= 12,
      run: (c) => ({
        title: 'A strange sail',
        body: '<p>A small ship is standing in toward the shore: a fishing ketch, out of the Newfoundland banks by the look of her. Her master will trade biscuit, powder and salt for pelts or tobacco.</p>',
        buttons: [
          { label: 'Trade ten pelts for 400 rations', primary: true, disabled: c.pelts < 10, act: () => { c.pelts -= 10; c.food += 400; chron('Traded pelts with a passing fishing ship for biscuit.'); } },
          { label: 'Trade ten pelts for powder and medicine', disabled: c.pelts < 10, act: () => { c.pelts -= 10; c.powder += 8; c.medicine += 6; } },
          { label: 'Let her pass', act: () => {} },
        ],
      }),
    },
    {
      id: 'alliance', once: true,
      ok: (c) => G().world.villages.some((v) => v.relation >= 2 && v.rival !== null && G().world.villages[v.rival] && G().world.villages[v.rival].contacted),
      run: (c) => {
        const vs = G().world.villages;
        const v = vs.find((x) => x.relation >= 2 && x.rival !== null && vs[x.rival] && vs[x.rival].contacted);
        const rv = vs[v.rival];
        return {
          title: 'An old feud',
          body: `<p>Messengers from ${esc(v.name)} ask for your help. They are going against ${esc(rv.name)}, and they want muskets with them. Friends help friends, they say.</p>`,
          buttons: [
            { label: 'Send four musketeers', act: () => { v.relation = 3; rv.relation = Math.max(-3, rv.relation - 3); rv.memory.push('The strangers came with our enemies to kill us.'); if (Math.random() < 0.4) { const p = LF.pick(workers()); if (p) kill(p, `killed fighting ${rv.name}`); } chron(`The colony sent musketeers with ${v.name} against ${rv.name}.`); } },
            { label: 'Stay out of it', primary: true, act: () => { v.relation = Math.max(-3, v.relation - 0.5); chron(`Refused to join ${v.name} in their war.`); } },
          ],
        };
      },
    },
    {
      id: 'hurricane', once: true,
      ok: (c) => c.env.coastal && monthOf(c.day) === 8 && Math.random() < 0.5,
      run: (c) => {
        const dock = done('dock')[0];
        if (dock) dock.progress = 0.3;
        if (!c.harvested) c.flags.hurricaneFields = true;
        for (const h of done('house').slice(0, 1)) h.progress = 0.6;
        chron('A hurricane came ashore in September.');
        return { title: 'Hurricane', body: `<p>The sky goes green and the wind comes off the sea. For a day and a night it blows. Roofs go, the ${dock ? 'dock is smashed, the ' : ''}corn is flattened, and the sea comes up over the beach.</p>` };
      },
    },
    {
      id: 'snow', once: true,
      ok: (c) => monthOf(c.day) === 11,
      run: (c) => {
        const short = alivePeople().length - beds(c);
        return { title: 'First snow', body: `<p>Snow in the night. By morning the town is white and quiet.</p><p>${short > 0 ? `<strong>${short} people have no roof.</strong> They will not all see spring.` : 'Everyone has a roof. That will matter.'}</p>` };
      },
    },
    {
      id: 'bear', once: true,
      ok: (c) => monthOf(c.day) >= 6 && monthOf(c.day) <= 7 && c.items.some((i) => i.type === 'field' && i.plantedDay),
      run: (c) => ({
        title: 'Bears in the corn',
        body: '<p>Something has been getting into the corn at night and flattening whole rows. Bears, by the tracks.</p>',
        buttons: [
          { label: 'Set a watch in the fields', primary: true, act: () => { if (c.powder > 0) { c.powder--; c.food += 60; clog('Shot a bear in the corn.'); } } },
          { label: 'Put up with it', act: () => { c.tendSum = (c.tendSum || 0) * 0.85; } },
        ],
      }),
    },
  ];

  function colonyEvent(c) {
    if (Math.random() > 0.55) return null;
    c.flags.ev = c.flags.ev || {};
    const pool = EVENTS.filter((e) => !(e.once && c.flags.ev[e.id]) && !(c.flags.ev[e.id] && c.turn - c.flags.ev[e.id] < 5) && e.ok(c));
    if (!pool.length) return null;
    const e = LF.pick(pool);
    c.flags.ev[e.id] = c.turn;
    return e.run(c);
  }

  // ---------------------------------------------------------------- colony screen

  function cropStage(b) {
    const c = G().colony;
    const m = monthOf(c.day);
    if (!b.plantedDay || b.progress < 1) return 'bare';
    if (b.harvested) return isWinter(c.day) ? 'bare' : 'stubble';
    const age = c.day - b.plantedDay;
    if (b.crop === 'tobacco') return age > 70 ? 'tobaccoRipe' : 'tobacco';
    if (age < 20) return 'sprout';
    if (m >= 8) return 'ripe';
    return 'green';
  }

  let people = [];
  function animatePeople(c) {
    // A handful of dots at work, placed near what they are doing.
    const out = [];
    const mid = N / 2;
    const add = (x, y, col, n) => { for (let k = 0; k < n; k++) out.push({ x: x + 0.5 + (Math.random() - 0.5) * 2, y: y + 0.5 + (Math.random() - 0.5) * 2, c: col }); };
    const building = c.items.find((i) => i.progress < 1 && !i.blocked);
    if (building) add(building.x ?? building.x0, building.y ?? building.y0, '#f3e5c3', Math.min(8, Math.ceil(c.jobs.build / 3)));
    const fields = c.items.filter((i) => i.type === 'field' && i.plantedDay);
    if (fields.length && c.jobs.farm) for (let k = 0; k < Math.min(6, c.jobs.farm); k++) { const f = LF.pick(fields); add(f.x, f.y, '#e8d6a0', 1); }
    if (!building && !fields.length) add(mid, mid, '#f3e5c3', 4);
    return out;
  }

  LF.usesChart.colony = () => true;
  LF.animating.colony = () => false;
  LF.stageDrawers.colony = (cv) => {
    const c = G().colony;
    LF.drawLocal(cv, { L: c.Ltrue, cam: lcam(), truth: true, items: c.items, hover: hoverOverlay(), season: LF.season(c.day), time: performance.now(), cropStage, title: `${c.site.name}, ${LF.dateOf(c.day).name}`, people });
    return true;
  };

  LF.ledgers.colony = () => {
    const c = G().colony;
    const pop = alivePeople().length;
    const sick = alivePeople().filter((p) => p.sick).length;
    const fd = foodProjection(c);
    const bd = beds(c);
    return `
      <div class="chip"><span class="k">${esc(LF.dateOf(c.day).name)}</span><span class="v">${LF.cap(LF.season(c.day))}</span></div>
      <div class="chip ${sick > pop * 0.2 ? 'warn' : ''}"><span class="k">People</span><span class="v">${pop}<small>${sick ? `, ${sick} sick` : ''}</small></span></div>
      <div class="chip ${fd < 30 ? 'bad' : fd < 60 ? 'warn' : ''}"><span class="k">Food</span><span class="v">${Math.floor(c.food).toLocaleString('en-US')}<small> ≈ ${fd} days</small></span></div>
      <div class="chip ${bd < pop ? 'warn' : ''}"><span class="k">Beds</span><span class="v">${bd}<small> / ${pop}</small></span></div>
      <div class="chip"><span class="k">Timber</span><span class="v">${Math.floor(c.timber)}</span></div>
      <div class="chip ${c.morale < 30 ? 'bad' : c.morale < 45 ? 'warn' : ''}"><span class="k">Spirits</span><span class="v">${c.morale >= 70 ? 'High' : c.morale >= 45 ? 'Fair' : c.morale >= 25 ? 'Low' : 'Breaking'}</span></div>`;
  };

  function queueList(c) {
    const rows = [];
    let fieldsPending = 0, fieldsDone = 0;
    for (const it of c.items) {
      if (it.type === 'field') { if (it.progress >= 1) fieldsDone++; else if (!it.blocked) fieldsPending++; continue; }
      if (it.progress >= 1) continue;
      rows.push(`<li class="${it.blocked ? 'blocked' : ''}"><div class="grow"><strong>${esc(B[it.type].name)}</strong>${it.blocked ? ` <span class="bad">${esc(it.reason)}</span>` : ` <span class="sub">${Math.round(it.progress * 100)}%</span>`}</div>
        <button class="btn icon sm" data-up="${it.id}" aria-label="Build sooner" ${it.blocked ? 'disabled' : ''}>↑</button>
        ${it.progress > 0 ? '' : `<button class="btn icon sm" data-rm="${it.id}" aria-label="Remove">×</button>`}</li>`);
    }
    const blockedFields = c.items.filter((i) => i.type === 'field' && i.blocked).length;
    return `<ul class="queue">${rows.join('')}<li><div class="grow"><strong>Fields</strong> <span class="sub">${fieldsDone} planted or cleared, ${fieldsPending} to go${blockedFields ? `, <span class="bad">${blockedFields} on bad ground</span>` : ''}</span></div>${blockedFields ? '<button class="btn sm" id="b-clearbad">Drop the bad ones</button>' : ''}</li></ul>`;
  }

  LF.panels.colony = {
    html() {
      const g = G(), c = g.colony;
      const n = workers().length;
      const used = Object.values(c.jobs).reduce((a, b) => a + b, 0);
      const jobs = Object.entries(JOBS).map(([k, j]) => `<div class="job"><div class="grow"><strong>${j.name}</strong><span>${esc(j.desc)}</span></div>
        <div class="stepper"><button class="btn icon sm" data-job="${k}" data-d="-1" aria-label="Fewer on ${esc(j.name)}">−</button><output>${c.jobs[k]}</output><button class="btn icon sm" data-job="${k}" data-d="1" aria-label="More on ${esc(j.name)}" ${used >= n ? 'disabled' : ''}>+</button></div></div>`).join('');
      const planted = c.items.filter((i) => i.type === 'field' && i.plantedDay).length;
      const weeksToShip = Math.max(0, Math.round((END_DAY - c.day) / 7));
      const recent = c.log.slice(-8).reverse().map((l) => `<li><span class="d">${esc(LF.dateOf(l.day).name)}</span> ${esc(l.text)}</li>`).join('');
      const water = goodWater(c);
      return `
        <h2>${esc(c.site.name)}</h2>
        <p class="lede">${c.harvested ? '' : c.day < 112 ? 'Get the fields planted before the middle of June if you can. ' : ''}The supply ship is due in about ${weeksToShip} weeks.</p>
        <dl class="facts">
          <dt>Water</dt><dd class="${water ? 'good' : 'bad'}">${water ? 'Clean water' : c.items.some((i) => i.type === 'well' && !i.blocked) ? 'None until the well is dug. Expect the flux.' : 'No clean water, and no well planned. Add one.'}</dd>
          <dt>Defense</dt><dd>${defense(c)}</dd>
          <dt>Trade goods</dt><dd>${c.tools} tools, ${c.cloth} cloth, ${c.beads} beads</dd>
          <dt>For export</dt><dd>${Math.floor(c.pelts)} pelts, ${Math.floor(c.tobacco).toLocaleString('en-US')} lb tobacco</dd>
          <dt>Powder, medicine</dt><dd>${Math.floor(c.powder)}, ${Math.floor(c.medicine)}</dd>
        </dl>
        <div class="actions"><button class="btn primary" id="b-turn">Work two weeks</button></div>
        <h3>Work <span class="count">${used} of ${n} able hands</span></h3>
        <label class="check"><input type="checkbox" id="auto-work" ${c.autoWork ? 'checked' : ''}><span>Harrow assigns the work each fortnight</span></label>
        <div class="jobs ${c.autoWork ? 'auto' : ''}">${jobs}</div>
        ${planted && !c.harvested ? `<div class="job"><div class="grow"><strong>Tobacco fields</strong><span>Export for the Company instead of food. ${planted} planted.</span></div><div class="stepper"><button class="btn icon sm" id="tob-" aria-label="Fewer tobacco fields">−</button><output>${c.tobaccoFields}</output><button class="btn icon sm" id="tob+" aria-label="More tobacco fields">+</button></div></div>` : ''}
        <h3>Building, in order</h3>
        ${queueList(c)}
        <details class="addmore"><summary>Add to the plan</summary>${toolbox()}</details>
        <h3>Chronicle</h3>
        <ul class="journal">${recent || '<li class="muted">Nothing yet.</li>'}</ul>`;
    },
    wire() {
      const c = G().colony;
      $('#b-turn').onclick = runTurn;
      $('#auto-work').onchange = (ev) => { c.autoWork = ev.target.checked; if (c.autoWork) autoJobs(c); LF.render(); };
      document.querySelectorAll('[data-job]').forEach((b) => (b.onclick = () => {
        const k = b.dataset.job, d = +b.dataset.d;
        const used = Object.values(c.jobs).reduce((a, x) => a + x, 0);
        if (d > 0 && used >= workers().length) return;
        c.jobs[k] = Math.max(0, c.jobs[k] + d);
        c.autoWork = false;
        LF.render();
      }));
      const tm = document.getElementById('tob-'), tp = document.getElementById('tob+');
      const planted = c.items.filter((i) => i.type === 'field' && i.plantedDay).length;
      if (tm) tm.onclick = () => { c.tobaccoFields = Math.max(0, c.tobaccoFields - 1); LF.render(); };
      if (tp) tp.onclick = () => { c.tobaccoFields = Math.min(planted, c.tobaccoFields + 1); LF.render(); };
      document.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => {
        const it = c.items.find((i) => i.id === +b.dataset.up);
        c.items = c.items.filter((i) => i !== it);
        const firstOpen = c.items.findIndex((i) => i.progress < 1 && !i.blocked);
        c.items.splice(firstOpen < 0 ? c.items.length : firstOpen, 0, it);
        LF.render();
      }));
      document.querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { c.items = c.items.filter((i) => i.id !== +b.dataset.rm); LF.render(); }));
      const cb = $('#b-clearbad');
      if (cb) cb.onclick = () => { c.items = c.items.filter((i) => !(i.type === 'field' && i.blocked)); LF.render(); };
      document.querySelectorAll('.tool').forEach((b) => (b.onclick = () => { c.tool = b.dataset.tool; LF.render(); const d = document.querySelector('.addmore'); if (d) d.open = true; }));
    },
  };

  function runTurn() {
    const g = G(), c = g.colony;
    const { report, ev } = turn();
    if (c.autoWork) autoJobs(c);
    people = animatePeople(c);
    if (c.day >= END_DAY || alivePeople().length === 0) {
      LF.render();
      LF.finishGame();
      return;
    }
    LF.render();
    LF.showModal({
      title: `Two weeks to the ${LF.dateOf(c.day).name}`,
      eyebrow: LF.cap(LF.season(c.day)),
      body: report.length ? `<ul class="night">${report.map((r) => `<li>${r}</li>`).join('')}</ul>` : '<p>Quiet weeks. Work went on.</p>',
      buttons: [{ label: 'Carry on', primary: true }],
    });
    if (ev) LF.queueModal(ev);
  }

  // Export value for the supply ship.
  LF.colonyExports = function () {
    const g = G(), c = g.colony;
    const lines = [];
    const pelts = Math.floor(c.pelts);
    if (pelts) lines.push([`${pelts} beaver and deer pelts`, pelts * 12]);
    const canLoad = done('dock').length || c.env.coastal;
    const boards = done('sawpit').length ? Math.min(Math.floor(c.timber), 400) : Math.min(Math.floor(c.timber), 150);
    if (boards >= 20) lines.push([`${boards} loads of ${done('sawpit').length ? 'sawn boards' : 'rough timber'}${canLoad ? '' : ', hauled overland to the boats'}`, Math.round(boards * (done('sawpit').length ? 0.6 : 0.3) * (canLoad ? 1 : 0.5))]);
    const tob = Math.floor(c.tobacco);
    if (tob) lines.push([`${tob.toLocaleString('en-US')} pounds of tobacco`, Math.round(tob * 0.4)]);
    let total = lines.reduce((a, l) => a + l[1], 0);
    if (g.advisors.voss.loyalty < 30) total = Math.round(total * 0.8);
    return { lines, total, quota: QUOTA };
  };
  LF.colonyAlive = alivePeople;
})();
