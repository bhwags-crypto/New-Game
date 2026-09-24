// The council: five officers argue over the sites, using nothing but the chart.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, esc, clamp, num, Num, first, listJoin } = LF;
  const $ = LF.$;
  const G = () => LF.G;

  const SITE_R = 5;
  LF.SITE_R = SITE_R;

  // What the chart says about the ground around a site.
  LF.dossier = function (site, K) {
    const g = G();
    K = K || g.K;
    let open = 0, oldfield = 0, forest = 0, pine = 0, wet = 0, hills = 0, game = 0, unknown = 0, n = 0, qsum = 0, staleSum = 0;
    let river = false, lake = false;
    const feats = {};
    LF.around(site.x, site.y, SITE_R, (x, y, d, j) => {
      const k = K.t[j];
      if (K.feat[j]) feats[K.feat[j]] = (feats[K.feat[j]] || 0) + 1;
      if (k < 0) { unknown++; return; }
      if (k === T.LAKE && d <= 3) lake = true;
      if (LF.isWater(k)) return;
      n++;
      qsum += K.q[j];
      staleSum += g.day - K.seen[j];
      if (LF.isOpen(k)) open++;
      if (k === T.OLDFIELD) oldfield++;
      if (k === T.FOREST) forest++;
      if (k === T.PINE) pine++;
      if (LF.isWet(k)) wet++;
      if (LF.isHigh(k)) hills++;
      if (K.game[j]) game++;
      if (K.river[j] && d <= 2.5) river = true;
    });
    const at = K.t[idx(site.x, site.y)];
    const onHill = at === T.HILLS || feats[F.CLIFF] > 0 && K.feat[idx(site.x, site.y)] === F.CLIFF;
    const hb = LF.harborShelter(K.t, site.x, site.y);
    const harbor = !hb.coastal ? 0 : hb.shelter > 0.52 ? 3 : hb.shelter > 0.4 ? 2 : 1;
    const spring = !!feats[F.SPRING];
    const water = river || spring || lake;
    const neighbors = [];
    for (const v of g.world.villages) {
      const pos = v.drawn;
      if (!pos) continue;
      const d = Math.hypot(pos.x - site.x, pos.y - site.y);
      if (d > 18) continue;
      neighbors.push({ v, d, inside: v.territoryKnown && d <= v.radius + 0.5 });
    }
    const conf = n ? qsum / n : 0;
    const landing = g.world.camp;
    const distMiles = Math.hypot(site.x - landing.x, site.y - landing.y) * LF.MILES_PER_TILE;
    return {
      open, oldfield, forest, pine, wet, hills, game, unknown, river, lake, spring, water, onHill, harbor, shelter: hb.shelter,
      feats, neighbors, conf, stale: n ? Math.round(staleSum / n) : 0, distMiles, onWater: LF.isWater(at),
      acres: open * LF.ACRES_PER_TILE,
    };
  };

  function rate(d) {
    const lvl = (v, cuts, words) => { let i = 0; while (i < cuts.length && v >= cuts[i]) i++; return words[i]; };
    const featNames = Object.keys(d.feats).map(Number).filter((f) => ![F.BURIAL, F.RUIN, F.FORD].includes(f)).map((f) => LF.F_INFO[f].phrase);
    return [
      ['Farmland', `${lvl(d.open, [1, 8, 16, 26], ['None drawn', 'Poor', 'Fair', 'Good', 'Rich'])}${d.open ? `, about ${d.acres.toLocaleString('en-US')} acres open${d.oldfield ? `, some already cleared` : ''}` : ''}`, d.open >= 16 ? 'good' : d.open >= 8 ? 'mid' : 'bad'],
      ['Timber', lvl(d.forest + d.pine, [4, 12, 24], ['Scarce', 'Fair', 'Good', 'Plenty']) + (d.pine > d.forest ? ', mostly pine' : ''), d.forest + d.pine >= 12 ? 'good' : d.forest + d.pine >= 4 ? 'mid' : 'bad'],
      ['Fresh water', d.river ? 'River at hand' : d.spring ? 'A spring' : d.lake ? 'A pond' : 'None drawn', d.water ? 'good' : 'bad'],
      ['Harbor', ['Inland', 'Open roadstead', 'Fair anchorage', 'Sheltered harbor'][d.harbor], d.harbor >= 2 ? 'good' : 'mid'],
      ['Defense', d.onHill ? 'On high ground' : d.hills >= 8 ? 'Hills nearby' : 'Open ground', d.onHill ? 'good' : 'mid'],
      ['Marsh', d.wet === 0 ? 'None drawn' : d.wet <= 5 ? 'Some low ground' : 'Much marsh', d.wet === 0 ? 'good' : d.wet <= 5 ? 'mid' : 'bad'],
      ['Game and furs', d.game >= 6 || d.feats[F.BEAVER] ? 'Plentiful' : d.game ? 'Some sign' : 'None noted', d.game >= 6 || d.feats[F.BEAVER] ? 'good' : 'mid'],
      ['Found nearby', featNames.length ? LF.cap(listJoin([...new Set(featNames)])) : 'Nothing noted', featNames.length ? 'good' : 'mid'],
      ['From the landing', `${Math.round(d.distMiles)} miles`, d.distMiles <= 8 ? 'good' : d.distMiles <= 15 ? 'mid' : 'bad'],
      ['Survey', d.unknown > 30 ? 'Largely unsurveyed' : d.conf < 0.65 ? 'Shaky' : d.conf < 0.8 ? 'Fair' : 'Sound', d.unknown > 30 || d.conf < 0.65 ? 'bad' : d.conf < 0.8 ? 'mid' : 'good'],
    ];
  }

  // ---------------------------------------------------------------- the officers' views

  const SCORE = {
    harrow: (d) => d.harbor * 3 + (d.river ? 4 : d.water ? 2 : 0) + (d.distMiles < 6 ? 2 : 0) + (d.feats[F.STONE] ? 1 : 0) - d.unknown * 0.05,
    pryce: (d) => (d.onHill ? 4 : d.hills >= 8 ? 2 : 0) + (d.water ? 3 : 0) - d.wet * 0.6 - (d.feats[F.BURIAL] ? 4 : 0) + d.neighbors.reduce((a, n) => a + (n.inside ? (n.v.promised ? -15 : -4) : n.v.relation >= 1 ? 1 : 0), 0),
    voss: (d) => (d.feats[F.BEAVER] ? 4 : 0) + (d.feats[F.SALTLICK] ? 2 : 0) + d.game * 0.3 + Math.min(d.forest, 20) * 0.12 + Math.min(d.pine, 12) * 0.1 + d.harbor * 2.5 + (d.feats[F.FALLS] ? 2 : 0),
    quarles: (d) => (d.onHill ? 5 : 0) + (d.feats[F.CLIFF] ? 3 : 0) + d.hills * 0.2 + (d.forest + d.pine >= 6 ? 1 : 0) - d.neighbors.reduce((a, n) => a + (n.v.relation < 0 && n.d < 12 ? 6 : 0), 0) - d.wet * 0.2,
    kemp: (d) => d.open * 0.25 + d.oldfield * 0.3 + (d.water ? 3 : 0) - d.distMiles * 0.15 - d.wet * 0.4,
  };

  function speech(key, s, d) {
    const nm = s.name;
    switch (key) {
      case 'harrow':
        if (d.harbor >= 3) return `A ship can lie safe at ${nm}. Everything we need for the next ten years comes by sea, and I want it landed dry.`;
        if (d.river && d.harbor) return `${nm} has fresh water and a river mouth for the boats. I can keep a storehouse there and fill it.`;
        if (d.water) return `${nm} has water. Everything else can be carried, but I will not dig wells in hope.`;
        return `None of these is what I hoped for. ${nm} is the least bad for getting stores ashore.`;
      case 'pryce':
        if (d.onHill) return `${nm} stands high. The ground drains, the air is clean, and we can see who comes.`;
        if (d.wet >= 6) return `Every site on this chart has low ground near it. ${nm} has the least I can see, and I have buried enough people from fever.`;
        return `${nm} is dry ground with water close by. We came here to live among neighbors, not on top of them.`;
      case 'voss':
        if (d.feats[F.BEAVER]) return `There are beaver ponds at ${nm}. The Company will forgive a great deal for a hold full of pelts.`;
        if (d.harbor >= 2) return `The Company needs returns on the first ship. ${nm} has timber within reach and water deep enough to load it.`;
        return `I need something to send home in the spring. ${nm} gives us the best chance of a cargo.`;
      case 'quarles':
        if (d.feats[F.CLIFF]) return `A bluff over the water. Put a blockhouse on ${nm} and no one takes it from us.`;
        if (d.onHill) return `${nm} is high ground. I can hold it with twelve muskets.`;
        return `I have seen nothing on this chart I would call defensible. ${nm} at least keeps us clear of anyone who hates us.`;
      case 'kemp':
        if (d.oldfield >= 3) return `The fields at ${nm} are already cleared. We could plant within a week of landing. Do you know what that means to people who have been eating ship’s biscuit since February?`;
        if (d.open >= 16) return `${nm} has open ground to plant. The settlers did not come here to spend the summer chopping trees.`;
        return `${nm} has the most open ground on this chart, and it is not far to carry our things.`;
    }
  }

  function objection(key, s, d) {
    const nm = s.name;
    switch (key) {
      case 'harrow': return !d.water ? `${nm} has no water drawn. I will not put a storehouse where there is nothing to drink.` : d.harbor === 0 ? `${nm} is inland. Every barrel will have to be hauled.` : null;
      case 'pryce':
        if (d.neighbors.some((n) => n.inside && n.v.promised)) return `${nm} is inside the hunting grounds we promised to leave alone. I will not bless a town built on a broken promise.`;
        if (d.feats[F.BURIAL]) return `There is a burial ground at ${nm}. You would build your houses on their dead?`;
        return d.wet >= 6 ? `${nm} is ringed with marsh. Fever will take a third of us by September.` : null;
      case 'voss': return d.harbor === 0 && !d.feats[F.BEAVER] ? `Nothing at ${nm} the Company can sell, and no way to ship it if there were.` : null;
      case 'quarles': return d.neighbors.some((n) => n.v.relation < 0 && n.d < 12) ? `${nm} is a day’s walk from people who already want us dead.` : !d.onHill && d.hills < 3 ? `${nm} is flat and open on every side.` : null;
      case 'kemp': return d.open < 8 ? `There is nothing to plant at ${nm} but trees.` : d.distMiles > 14 ? `${nm} is ${Math.round(d.distMiles)} miles from the landing. Who carries our things that far?` : null;
    }
  }

  function views() {
    const g = G();
    const list = g.sites.map((s) => ({ s, d: LF.dossier(s) }));
    const out = {};
    for (const key of Object.keys(LF.ADVISORS)) {
      const ranked = list.slice().sort((a, b) => SCORE[key](b.d) - SCORE[key](a.d));
      const best = ranked[0];
      const worst = ranked.slice(1).find((x) => objection(key, x.s, x.d)) || null;
      out[key] = { site: best.s, line: speech(key, best.s, best.d), objection: worst ? objection(key, worst.s, worst.d) : null, against: worst ? worst.s : null };
    }
    return out;
  }

  // ---------------------------------------------------------------- questions

  function questions() {
    const g = G();
    const qs = [];
    for (const s of g.sites) {
      if (s.isLanding) continue;
      const who = s.byId ? LF.crewById(s.byId) : null;
      qs.push({ id: 'sure-' + s.letter, label: `Ask ${who ? who.name : 'the party'} how sure they are of ${s.name}`, run: () => answerSure(s, who) });
    }
    const tr = g.crew.find((c) => c.alive && c.tongue >= 2);
    if (tr && g.world.villages.some((v) => v.contacted && v.relation >= 1)) qs.push({ id: 'towns', label: `Ask ${tr.name} what the towns said about the land`, run: () => answerTowns(tr) });
    const hunter = g.crew.find((c) => c.alive && c.forage >= 2);
    if (hunter) qs.push({ id: 'game', label: `Ask ${hunter.name} where the hunting is best`, run: () => answerGame(hunter) });
    qs.push({ id: 'stores', label: 'Ask Harrow how long the stores will last', run: answerStores });
    qs.push({ id: 'company', label: 'Ask Voss what the Company expects', run: answerCompany });
    const doc = g.crew.find((c) => c.alive && c.heal >= 2);
    if (doc) qs.push({ id: 'health', label: `Ask ${doc.name} which site is healthiest`, run: () => answerHealth(doc) });
    return qs;
  }

  function trueAround(s, fn) {
    const w = G().world;
    LF.around(s.x, s.y, SITE_R, (x, y, d, j) => fn(w.t[j], j, d));
  }

  function answerSure(s, who) {
    if (!who) return 'Nobody who planted that stake can say more than what is on the chart.';
    if (!who.alive) return `${who.name} is dead. Nobody else can speak to it.`;
    const drifted = s.tx !== s.x || s.ty !== s.y;
    const d = LF.dossier(s);
    const bits = [];
    if (who.survey >= 3 && !drifted) bits.push('I would put my name to every line of it.');
    else if (who.survey >= 2 && drifted) bits.push('Something was off with our distances on that trip. I would not swear the stake is where the chart puts it. Could be a mile out.');
    else if (drifted) bits.push('Truth is, we were not sure where we were half the time.');
    else if (who.survey >= 2) bits.push('The ground I walked myself, I trust.');
    else bits.push('I am no surveyor. I drew what I saw as best I could.');
    if (d.unknown > 20) bits.push('Much of the ground around it we never saw at all.');
    if (d.conf < 0.7) bits.push('The far side I drew from a distance. Some of that could be wrong.');
    if (!s.compass && who.survey >= 1) bits.push('We had no compass and chain on that trip.');
    return `“${bits.join(' ')}”`;
  }

  function answerTowns(tr) {
    const g = G();
    const out = [];
    for (const s of g.sites) {
      let wet = 0, burial = false;
      trueAround(s, (k, j) => { if (LF.isWet(k)) wet++; if (g.world.feat[j] === F.BURIAL) burial = true; });
      const knows = g.world.villages.some((v) => v.contacted && v.relation >= 1 && Math.hypot(v.x - s.x, v.y - s.y) < 16);
      if (!knows) continue;
      if (burial) out.push(`At ${s.name} there is a burying place. They would not forgive building on it.`);
      else if (wet >= 10) out.push(`They say the low ground around ${s.name} is sickly in summer. Their own people will not camp there.`);
      else if (wet <= 2) out.push(`${s.name} they call good ground. Dry, with sweet water.`);
    }
    if (!out.length) return `“They spoke of the land near their towns. None of our sites came up that I could make out.”`;
    return `“${out.join(' ')}”`;
  }

  function answerGame(h) {
    const g = G();
    let best = null, bn = -1;
    for (const s of g.sites) {
      let n = 0;
      trueAround(s, (k, j) => { if (g.world.game[j] && G().K.t[j] >= 0) n++; });
      if (n > bn) { bn = n; best = s; }
    }
    if (bn <= 2) return `“None of them, from what I saw. Thin country for deer everywhere we staked.”`;
    return `“${best.name}. I saw more sign there than anywhere.”`;
  }

  function answerStores() {
    const g = G();
    const pop = LF.settlersAboard() + g.crew.filter((c) => c.alive).length;
    const food = g.hold + g.stores.rations;
    const days = Math.floor(food / pop);
    const late = g.day - 38;
    return `“Between the hold and the landing we have ${Math.floor(food).toLocaleString('en-US')} rations. For ${pop} people that is ${days} days, if nothing spoils. After that we eat what we grow, catch or trade for.${late > 0 ? ' And we are late. Corn should be in the ground by now.' : ' Corn wants to be in the ground by mid-June.'}”`;
  }

  function answerCompany() {
    return '“The Company expects a cargo on the supply ship next May: pelts first, then sawn timber and masts, then tobacco if we can grow it. Fill the hold and they will send more settlers. Send it back empty and they may not send anything.”';
  }

  function answerHealth(doc) {
    const g = G();
    let best = null, bw = Infinity, worst = null, ww = -1;
    for (const s of g.sites) {
      let wet = 0;
      LF.around(s.x, s.y, SITE_R, (x, y, d, j) => { if (G().K.t[j] >= 0 && LF.isWet(g.world.t[j])) wet++; });
      if (wet < bw) { bw = wet; best = s; }
      if (wet > ww) { ww = wet; worst = s; }
    }
    if (best === worst) return `“I cannot choose between them on what we know.”`;
    return `“Of the ground we actually saw, ${best.name} is the driest. I would keep well away from ${worst.name}. ${ww >= 8 ? 'That much standing water means fever.' : ''}”`;
  }

  // ---------------------------------------------------------------- council screen

  LF.openCouncil = function () {
    const g = G();
    if (g.party) return;
    g.mode = 'council';
    g.council = g.council || { tab: 'debate', asked: [], left: 4 };
    g.councilFocus = null;
    LF.render();
  };

  LF.chartExtras.council = () => {
    const f = G().councilFocus;
    return f ? { highlight: { x: f.x, y: f.y, r: SITE_R + 0.5 } } : {};
  };

  LF.panels.council = {
    html() {
      const g = G(), c = g.council;
      const v = views();
      const tabs = [['debate', 'The debate'], ['sites', 'The sites'], ['ask', `Questions (${c.left})`]].map(([k, l]) => `<button class="tab ${c.tab === k ? 'on' : ''}" data-tab="${k}" aria-pressed="${c.tab === k}">${l}</button>`).join('');
      let body = '';
      if (c.tab === 'debate') {
        body = Object.keys(LF.ADVISORS).map((k) => {
          const a = LF.ADVISORS[k], st = g.advisors[k], vw = v[k];
          return `<article class="speaker"><header><span class="medal">${a.initials}</span><div class="grow"><strong>${esc(a.name)}</strong> <span class="role">${esc(a.role)}</span><div class="sub">Wants ${esc(a.wants)}.</div></div><span class="favors" title="Favors this site"><span class="seal sm">${vw.site.letter}</span></span></header>
            <blockquote><p>“${esc(vw.line)}”</p>${vw.objection ? `<p class="obj">“${esc(vw.objection)}”</p>` : ''}</blockquote>
            <div class="loyal"><span class="k">Loyalty</span>${LF.meter(st.loyalty)}</div></article>`;
        }).join('');
        if (c.asked.length) body += `<h3>What was said</h3><ul class="transcript">${c.asked.map((a) => `<li><p class="q">${esc(a.q)}</p><p>${esc(a.a)}</p></li>`).join('')}</ul>`;
      } else if (c.tab === 'sites') {
        body = g.sites.map((s) => {
          const d = LF.dossier(s);
          const fans = Object.entries(v).filter(([, x]) => x.site === s).map(([k]) => LF.ADVISORS[k].name.split(' ').slice(-1)[0]);
          const rows = rate(d).map(([k, val, cls]) => `<dt>${k}</dt><dd class="${cls}">${esc(val)}</dd>`).join('');
          const nb = d.neighbors.map((n) => `<li>${esc(LF.cap(n.v.name))}, ${Math.round(n.d * LF.MILES_PER_TILE)} miles${n.inside ? `. <strong class="bad">Inside their hunting grounds${n.v.promised ? ', which you promised to leave alone' : ''}.</strong>` : n.v.relation < 0 ? '. <strong class="bad">Hostile.</strong>' : n.v.relation >= 1 ? '. Friendly.' : '.'}</li>`).join('');
          return `<article class="dossier" data-site="${s.letter}" tabindex="0">
            <header><span class="seal">${s.letter}</span><div><h4>${esc(s.name)}</h4><div class="sub">Surveyed by ${esc(s.by)}, ${esc(LF.dateOf(s.day).name)}${d.stale > 12 ? `. The chart here is ${d.stale} days old.` : ''}</div></div></header>
            ${d.onWater ? '<p class="bad">The chart puts this stake in open water.</p>' : ''}
            ${d.feats[F.BURIAL] ? '<p class="bad">A burial ground is marked nearby.</p>' : ''}
            <dl class="facts">${rows}</dl>
            ${nb ? `<ul class="neighbors">${nb}</ul>` : ''}
            ${fans.length ? `<p class="fans">Favored by ${esc(listJoin(fans))}</p>` : ''}
            <button class="btn primary" data-found="${s.letter}">Settle here</button>
          </article>`;
        }).join('');
      } else {
        const qs = questions().filter((q) => !c.asked.some((a) => a.id === q.id));
        body = `<p class="hint">You can put ${LF.plural(c.left, 'more question')} to the council before it grows impatient. Answers appear under the debate.</p>
          <div class="qlist">${qs.map((q) => `<button class="btn qbtn" data-q="${q.id}" ${c.left ? '' : 'disabled'}>${esc(q.label)}</button>`).join('')}</div>`;
      }
      return `
        <h2>The council</h2>
        <p class="lede">The officers argue over the chart. Every report comes from the chart alone, and the chart may be wrong. Overrule them and they will remember it.</p>
        <div class="tabs" role="tablist">${tabs}</div>
        <div class="tabbody">${body}</div>
        <div class="actions"><button class="btn ghost" id="b-back">${g.day > LF.DEADLINE ? 'Back to the map table' : 'Adjourn and send out more parties'}</button></div>`;
    },
    wire() {
      const g = G(), c = g.council;
      document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { c.tab = b.dataset.tab; LF.render(); $('#panel').scrollTop = 0; }));
      const back = $('#b-back');
      if (back) back.onclick = () => { g.mode = 'camp'; g.councilFocus = null; LF.render(); };
      document.querySelectorAll('.qbtn').forEach((b) => (b.onclick = () => {
        const q = questions().find((x) => x.id === b.dataset.q);
        if (!q || !c.left) return;
        c.left--;
        c.asked.push({ id: q.id, q: q.label, a: q.run() });
        c.tab = 'debate';
        LF.render();
        $('#panel').scrollTop = $('#panel').scrollHeight;
      }));
      document.querySelectorAll('.dossier').forEach((el) => {
        const focus = () => { g.councilFocus = g.sites.find((x) => x.letter === el.dataset.site); LF.drawStage(); };
        el.onmouseenter = focus;
        el.onfocus = focus;
        el.onclick = (ev) => { if (!ev.target.closest('button')) { focus(); LF.focusChart(g.councilFocus.x, g.councilFocus.y, 12); LF.drawStage(); } };
      });
      document.querySelectorAll('[data-found]').forEach((b) => (b.onclick = () => confirmSite(g.sites.find((x) => x.letter === b.dataset.found))));
    },
  };

  function reactions(site) {
    const g = G();
    const d = LF.dossier(site);
    const v = views();
    const out = [];
    for (const k of Object.keys(LF.ADVISORS)) {
      let delta = v[k].site === site ? 10 : -4;
      let note = v[k].site === site ? 'agrees' : 'would have chosen otherwise';
      if (k === 'pryce' && d.neighbors.some((n) => n.inside && n.v.promised)) { delta = -25; note = 'refuses to bless a broken promise'; }
      else if (k === 'pryce' && d.feats[F.BURIAL]) { delta = -15; note = 'is appalled at the burial ground'; }
      if (k === 'quarles' && d.neighbors.some((n) => n.v.relation < 0 && n.d < 10)) { delta = -15; note = 'thinks you are inviting a massacre'; }
      if (k === 'kemp' && d.distMiles > 14) { delta = Math.min(delta, -10); note = 'says the settlers will curse every mile'; }
      if (k === 'harrow' && !d.water) { delta = Math.min(delta, -10); note = 'will not answer for the water'; }
      if (k === 'voss' && d.harbor === 0 && !d.feats[F.BEAVER]) { delta = Math.min(delta, -12); note = 'is already drafting his letter to the Company'; }
      out.push({ k, delta, note });
    }
    return out;
  }

  function confirmSite(site) {
    const g = G();
    const r = reactions(site);
    const lines = r.map(({ k, delta, note }) => `<li class="${delta > 0 ? 'ok' : 'no'}"><strong>${esc(LF.ADVISORS[k].name)}</strong> ${esc(note)}.</li>`).join('');
    LF.showModal({
      title: `Settle at ${site.name}?`,
      body: `<p>The <em>Constant</em> will sail to ${esc(site.name)} and put everyone ashore. Then you will lay out the town. There is no second choice.</p><ul class="reactions">${lines}</ul>${g.day < LF.DEADLINE ? `<p class="muted">You still have ${LF.plural(LF.DEADLINE - g.day, 'day')} before Blount sails. Every day now is a day later to plant.</p>` : ''}`,
      buttons: [
        { label: 'Found the colony here', primary: true, act: () => {
          for (const { k, delta } of r) g.advisors[k].loyalty = clamp(g.advisors[k].loyalty + delta, 0, 100);
          for (const [k, st] of Object.entries(g.advisors)) if (!st.missionDone) st.loyalty = clamp(st.loyalty - 8, 0, 100);
          g.chosen = site;
          LF.journal(`The council chose ${site.name}.`);
          LF.beginFounding(site);
        } },
        { label: 'Not yet' },
      ],
    });
  }
})();
