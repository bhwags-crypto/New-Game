// The end of the first year: the supply ship, the verdict, and the truth about the land.
(function () {
  const LF = window.LF;
  const { T, F, W, H, idx, inb, esc, clamp, num, Num, listJoin } = LF;
  const $ = LF.$;
  const G = () => LF.G;

  // How good a place really is, judged on the true land.
  LF.siteValue = function (x, y) {
    const w = G().world;
    if (!inb(x, y) || !LF.isLand(w.t[idx(x, y)]) || LF.isWet(w.t[idx(x, y)])) return -99;
    let open = 0, oldf = 0, wet = 0, woods = 0, game = 0, river = false, spring = false, lake = false, burial = false, beaver = 0, falls = false, clay = false, stone = false;
    LF.around(x, y, LF.SITE_R, (ax, ay, d, j) => {
      const k = w.t[j];
      if (LF.isOpen(k)) open++;
      if (k === T.OLDFIELD) oldf++;
      if (LF.isWet(k)) wet++;
      if (LF.isWoods(k)) woods++;
      if (w.game[j]) game++;
      if (w.river[j] && d <= 2.5) river = true;
      if (k === T.LAKE && d <= 3) lake = true;
      const f = w.feat[j];
      if (f === F.SPRING && d <= 3) spring = true;
      if (f === F.BURIAL && d <= 2.5) burial = true;
      if (f === F.BEAVER) beaver++;
      if (f === F.FALLS && d <= 3) falls = true;
      if (f === F.CLAY) clay = true;
      if (f === F.STONE) stone = true;
    });
    const hb = LF.harborShelter(w.t, x, y);
    const high = LF.isHigh(w.t[idx(x, y)]) || w.feat[idx(x, y)] === F.CLIFF;
    let v = Math.min(open, 30) * 1.0 + oldf * 0.5 + (river || spring || lake ? 10 : 0) + (hb.coastal ? (hb.shelter > 0.52 ? 8 : hb.shelter > 0.4 ? 5 : 2) : 0);
    v += Math.min(woods, 30) * 0.25 + game * 0.2 + beaver * 3 + (falls ? 3 : 0) + (clay ? 2 : 0) + (stone ? 2 : 0) + (high ? 4 : 0);
    v -= wet * 0.9 + (burial ? 10 : 0);
    for (const vil of w.villages) if (Math.hypot(vil.x - x, vil.y - y) <= vil.radius + 0.5) v -= 12;
    return v;
  };

  function bestSites() {
    const g = G();
    let best = null, bv = -Infinity, seen = null, sv = -Infinity;
    const all = [];
    for (let y = 2; y < H - 2; y++)
      for (let x = 2; x < W - 2; x++) {
        const v = LF.siteValue(x, y);
        if (v <= -99) continue;
        all.push(v);
        if (v > bv) { bv = v; best = { x, y, v }; }
        if (g.K.t[idx(x, y)] >= 0 && g.K.src[idx(x, y)] !== 2 && v > sv) { sv = v; seen = { x, y, v }; }
      }
    all.sort((a, b) => b - a);
    return { best, seen, all };
  }

  function describe(x, y) {
    const w = G().world;
    const bits = [];
    const hb = LF.harborShelter(w.t, x, y);
    let river = false, open = 0, oldf = 0, wet = 0;
    const feats = new Set();
    LF.around(x, y, LF.SITE_R, (ax, ay, d, j) => {
      if (w.river[j] && d <= 2.5) river = true;
      if (LF.isOpen(w.t[j])) open++;
      if (w.t[j] === T.OLDFIELD) oldf++;
      if (LF.isWet(w.t[j])) wet++;
      if (w.feat[j] && ![F.BURIAL, F.FORD].includes(w.feat[j])) feats.add(LF.F_INFO[w.feat[j]].phrase);
    });
    if (hb.coastal) bits.push(hb.shelter > 0.52 ? 'a sheltered harbor' : 'an anchorage');
    if (river) bits.push('a river for fresh water');
    if (open >= 16) bits.push(`${(open * LF.ACRES_PER_TILE).toLocaleString('en-US')} acres of open ground${oldf ? ', some of it already cleared' : ''}`);
    if (feats.size) bits.push(listJoin([...feats]));
    if (wet <= 2) bits.push('almost no marsh');
    return listJoin(bits) || 'fair ground';
  }

  function discrepancies(site) {
    const g = G(), w = g.world;
    const pairs = new Map();
    let unknown = 0;
    LF.around(site.x, site.y, LF.SITE_R, (x, y, d, j) => {
      const drawn = g.K.t[j], truth = w.t[j];
      if (drawn < 0) { unknown++; return; }
      const dw = drawn === T.DEEP ? T.SEA : drawn, tr = truth === T.DEEP ? T.SEA : truth;
      if (dw === tr) return;
      const key = dw + ':' + tr;
      pairs.set(key, (pairs.get(key) || 0) + 1);
    });
    const acres = (n) => (n * LF.ACRES_PER_TILE).toLocaleString('en-US');
    const lines = [...pairs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => {
      const [a, b] = k.split(':').map(Number);
      return `About ${acres(n)} acres drawn as ${LF.T_SHORT[a]} ${n > 1 ? 'were' : 'was'} ${LF.T_SHORT[b]}.`;
    });
    if (unknown) lines.push(`About ${acres(unknown)} acres around the site had never been surveyed at all.`);
    return lines;
  }

  LF.finishGame = function () {
    const g = G(), c = g.colony;
    const people = c.people;
    const landed = people.length;
    const alive = people.filter((p) => p.alive).length;
    const exp = LF.colonyExports();
    const rate = alive / Math.max(1, people.filter((p) => !p.child).length);
    const resupply = exp.total >= exp.quota;
    let verdict;
    if (alive === 0) verdict = 'lost';
    else if (rate >= 0.85 && resupply) verdict = 'thrived';
    else if (rate >= 0.7) verdict = 'endured';
    else if (rate >= 0.45) verdict = 'held on';
    else verdict = 'failed';
    const bs = bestSites();
    const mine = LF.siteValue(c.cx, c.cy);
    const rank = bs.all.filter((v) => v > mine).length + 1;
    const pct = mine <= -99 ? 0 : Math.max(0, Math.round((1 - rank / bs.all.length) * 100));
    g.result = { verdict, alive, landed, exp, resupply, best: bs.best, seen: bs.seen, mine, rank, pct, total: bs.all.length };
    g.mode = 'end';
    g.endView = 'truth';
    LF.resetCams();
    LF.render();
  };

  const VERDICTS = {
    thrived: ['The colony thrived', 'A full hold went home, and the Company is sending more settlers.'],
    endured: ['The colony endured', 'It was a hard year, but the town is still standing.'],
    'held on': ['The colony barely held on', 'The survivors need a better year, and soon.'],
    failed: ['The colony failed', 'In May the survivors boarded the supply ship and sailed for home.'],
    lost: ['The colony was lost', 'When the supply ship came in May, it found only graves.'],
  };

  LF.usesChart.end = () => true;
  LF.stageDrawers.end = (cv) => {
    const g = G();
    if (g.endView !== 'town') return false;
    const c = g.colony;
    if (!LF.localCam) LF.fitLocal();
    LF.drawLocal(cv, { L: c.Ltrue, cam: LF.localCam, truth: true, items: c.items, season: 'spring', time: 0, cropStage: () => 'bare', title: `${c.site.name} after one year` });
    return true;
  };
  LF.panners.end = () => (G().endView === 'town' ? LF.localCam : LF.getChartCam());
  LF.chartExtras.end = () => {
    const g = G(), r = g.result, c = g.colony;
    const marks = [];
    if (r.best) marks.push({ x: r.best.x, y: r.best.y, label: 'The best ground on this coast', color: '#e0bb6c' });
    if (r.seen && r.best && (r.seen.x !== r.best.x || r.seen.y !== r.best.y)) marks.push({ x: r.seen.x, y: r.seen.y, label: 'The best ground you saw', color: '#cfd6d8' });
    return { truth: g.endView === 'truth' ? g.world : null, highlight: { x: c.cx, y: c.cy, r: LF.SITE_R + 0.5 }, marks, title: g.endView === 'truth' ? 'The land as it was' : 'The chart the council used' };
  };

  LF.ledgers.end = () => {
    const r = G().result;
    return `<div class="chip"><span class="k">The 1st of May</span><span class="v">One year</span></div>
      <div class="chip"><span class="k">Alive</span><span class="v">${r.alive}<small> of ${r.landed}</small></span></div>
      <div class="chip ${r.resupply ? '' : 'warn'}"><span class="k">Cargo</span><span class="v">${r.exp.total}<small> / ${r.exp.quota}</small></span></div>`;
  };

  LF.panels.end = {
    html() {
      const g = G(), r = g.result, c = g.colony;
      const [title, sub] = VERDICTS[r.verdict];
      const deaths = c.deaths.filter((d) => !d.deserted);
      const causes = {};
      for (const d of deaths) {
        const k = d.cause.startsWith('killed') ? 'violence' : d.cause;
        causes[k] = (causes[k] || 0) + 1;
      }
      const causeText = Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${num(n)} to ${k}`);
      const notable = deaths.filter((d) => d.crewId || d.officer).map((d) => d.name);
      const chronicle = c.chronicle.map((e) => `<li><span class="d">${esc(LF.dateOf(e.day).name)}</span> ${esc(e.text)}</li>`).join('');
      const exp = r.exp;
      const cargo = exp.lines.length ? `<ul class="plist">${exp.lines.map(([t, v]) => `<li>${esc(t)} <span class="sub">worth ${v}</span></li>`).join('')}</ul>` : '<p>The hold went home empty.</p>';
      const company = r.resupply
        ? 'The Company is pleased. It will send two ships next spring, with sixty more settlers.'
        : exp.total >= exp.quota * 0.5
        ? 'The Company is disappointed. It will send one small ship, and no more settlers until the colony pays its way.'
        : 'The Company writes the colony off as a loss. No more ships are promised.';
      const disc = discrepancies({ x: c.cx, y: c.cy });
      const vs = g.world.villages.map((v) => {
        const mood = v.relation >= 2 ? 'friends' : v.relation >= 1 ? 'friendly' : v.relation >= 0 ? (v.contacted ? 'wary' : 'never met') : v.relation >= -2 ? 'hostile' : 'at war with you';
        const mem = v.memory.slice(-2).map((m) => `“${esc(m)}”`).join(' ');
        return `<li><strong>${esc(LF.cap(v.name))}</strong>: ${mood}.${mem ? ` <span class="sub">${mem}</span>` : ''}</li>`;
      }).join('');
      const advisors = Object.entries(LF.ADVISORS).map(([k, a]) => {
        const l = g.advisors[k].loyalty;
        const dead = c.deaths.some((d) => d.officer === k);
        return `<li><strong>${esc(a.name)}</strong>: ${dead ? 'died this year' : l >= 70 ? 'a firm ally' : l >= 45 ? 'loyal enough' : l >= 25 ? 'resentful' : 'working against you'}.</li>`;
      }).join('');
      const bestTxt = r.best ? `<p>The best ground on this coast was ${LF.miles(Math.hypot(r.best.x - g.world.camp.x, r.best.y - g.world.camp.y))} ${LF.bearing(r.best.x - g.world.camp.x, r.best.y - g.world.camp.y)} of the landing: ${esc(describe(r.best.x, r.best.y))}. ${g.K.t[idx(r.best.x, r.best.y)] >= 0 && g.K.src[idx(r.best.x, r.best.y)] !== 2 ? 'Your surveyors saw it.' : 'None of your parties ever got there.'}</p>` : '';
      const seenTxt = r.seen && r.best && (r.seen.x !== r.best.x || r.seen.y !== r.best.y) ? `<p>Of the ground your parties actually saw, the best was ${LF.miles(Math.hypot(r.seen.x - g.world.camp.x, r.seen.y - g.world.camp.y))} ${LF.bearing(r.seen.x - g.world.camp.x, r.seen.y - g.world.camp.y)} of the landing: ${esc(describe(r.seen.x, r.seen.y))}.</p>` : '';
      const views = [['truth', 'The land as it was'], ['chart', 'Your chart'], ['town', 'The town']].map(([k, l]) => `<button class="tab ${g.endView === k ? 'on' : ''}" data-view="${k}" aria-pressed="${g.endView === k}">${l}</button>`).join('');
      return `
        <p class="eyebrow">The first year at ${esc(c.site.name)}</p>
        <h2 class="verdict ${r.verdict.replace(' ', '-')}">${title}</h2>
        <p class="lede">${sub}</p>
        <div class="tally"><div><span class="v">${r.alive}</span><span class="k">alive in May</span></div><div><span class="v">${deaths.length}</span><span class="k">dead</span></div><div><span class="v">${r.pct}%</span><span class="k">of sites were worse</span></div></div>
        <div class="tabs">${views}</div>
        <div class="story">
          <p>${c.people.length} people went ashore at ${esc(c.site.name)} on the ${esc(LF.dateOf(c.landDay).name)}. ${deaths.length ? `By May, ${deaths.length} of them had died: ${esc(listJoin(causeText))}.` : 'By May, every one of them was still alive.'}${notable.length ? ` Among the dead were ${esc(listJoin(notable))}.` : ''}</p>
        </div>
        <h3>The supply ship</h3>
        ${cargo}
        <p>${esc(company)}</p>
        <h3>Where you should have settled</h3>
        <p>Your site was better than ${r.pct}% of the places a town could have gone on this coast.</p>
        ${bestTxt}${seenTxt}
        <h3>What the chart got wrong</h3>
        ${disc.length ? `<ul class="journal">${disc.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : '<p>Around the site, the chart was right in every particular.</p>'}
        <h3>The neighbors</h3>
        <ul class="journal">${vs}</ul>
        <h3>Your officers</h3>
        <ul class="journal">${advisors}</ul>
        <h3>Chronicle</h3>
        <ul class="journal">${chronicle}</ul>
        <div class="actions"><button class="btn primary" id="b-again">Found another colony</button></div>`;
    },
    wire() {
      const g = G();
      document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { g.endView = b.dataset.view; LF.resetCams(); LF.render(); }));
      $('#b-again').onclick = () => LF.newGame((Math.random() * 1e9) | 0);
    },
  };
})();
