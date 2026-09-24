// Static game data: people, traits, gear, advisors and buildings.
(function () {
  const LF = window.LF;

  LF.SKILLS = [['survey', 'Survey'], ['forage', 'Forage'], ['guard', 'Guard'], ['tongue', 'Tongue'], ['heal', 'Healing']];

  LF.TRAITS = {
    methodical: { name: 'Methodical', good: true, desc: 'Draws fewer errors. Hates a forced march: it ruins the work.' },
    quickhand: { name: 'Quick hand', good: true, desc: 'Redraws a day’s notes by the fire twice as well.' },
    glutton: { name: 'Glutton', good: false, desc: 'Eats half again as much.' },
    keeneyed: { name: 'Keen-eyed', good: true, desc: 'The party sees half a mile farther.' },
    swimmer: { name: 'Swimmer', good: true, desc: 'Makes river crossings safer for everyone.' },
    hothead: { name: 'Hothead', good: false, desc: 'Quick to shoot. Tense meetings can go badly.' },
    steady: { name: 'Steady', good: true, desc: 'Keeps the party’s spirits from sinking too low.' },
    patient: { name: 'Patient', good: true, desc: 'First meetings go better with this one doing the talking.' },
    hardy: { name: 'Hardy', good: true, desc: 'Often shrugs off hunger and fever.' },
    builder: { name: 'Builder', good: true, desc: 'Speeds building at the colony.' },
    woodsman: { name: 'Woodsman', good: true, desc: 'The party moves faster through forest.' },
    homesick: { name: 'Homesick', good: false, desc: 'Loses heart quickly. May desert.' },
    waterman: { name: 'Waterman', good: true, desc: 'Handles a canoe well. Faster on the water, easier portages.' },
    nightowl: { name: 'Night owl', good: true, desc: 'Safer to march after dark.' },
    devout: { name: 'Devout', good: true, desc: 'Prayers at the fire lift the party’s spirits.' },
    clumsy: { name: 'Clumsy', good: false, desc: 'Prone to accidents.' },
    greenhand: { name: 'Green hand', good: false, desc: 'New to wild country. Tires quickly.' },
  };

  LF.CREW = [
    { id: 'hale', name: 'Thomas Hale', role: 'Surveyor', survey: 3, forage: 0, guard: 0, tongue: 0, heal: 0, traits: ['methodical'], note: 'Trained under the Company chartmakers. Slow, and exact.' },
    { id: 'pell', name: 'Agnes Pell', role: 'Surveyor', survey: 2, forage: 1, guard: 0, tongue: 0, heal: 0, traits: ['quickhand'], note: 'Keeps the ship’s log. A fast sketcher, sometimes too fast.' },
    { id: 'crane', name: 'Josiah Crane', role: 'Hunter', survey: 0, forage: 3, guard: 1, tongue: 0, heal: 0, traits: ['glutton'], note: 'Fed a garrison through a hard winter once, and mentions it often.' },
    { id: 'whitlock', name: 'Mary Whitlock', role: 'Hunter', survey: 1, forage: 2, guard: 0, tongue: 0, heal: 0, traits: ['keeneyed', 'swimmer'], note: 'Grew up trapping in the fens. Reads ground well.' },
    { id: 'ashby', name: 'Samuel Ashby', role: 'Soldier', survey: 0, forage: 0, guard: 3, tongue: 0, heal: 0, traits: ['hothead'], note: 'Veteran of two sieges. Sleeps with his musket.' },
    { id: 'dunning', name: 'Robert Dunning', role: 'Soldier', survey: 0, forage: 1, guard: 2, tongue: 0, heal: 0, traits: ['steady'], note: 'Young and even-tempered. Can shoot for the pot.' },
    { id: 'rowe', name: 'Elias Rowe', role: 'Translator', survey: 0, forage: 0, guard: 0, tongue: 3, heal: 0, traits: ['patient'], note: 'Spent two years among the coastal peoples on an earlier voyage.' },
    { id: 'colby', name: 'Hannah Colby', role: 'Physician', survey: 0, forage: 0, guard: 0, tongue: 0, heal: 3, traits: ['hardy'], note: 'Carries Jesuit’s bark for fevers, and a saw for worse.' },
    { id: 'fenwick', name: 'John Fenwick', role: 'Carpenter', survey: 1, forage: 1, guard: 1, tongue: 0, heal: 0, traits: ['builder', 'woodsman'], note: 'Good with a compass and chain. Better with an adze.' },
    { id: 'tapp', name: 'William Tapp', role: 'Laborer', survey: 0, forage: 1, guard: 1, tongue: 1, heal: 0, traits: ['homesick', 'swimmer'], note: 'Picked up a few words of the coast trade tongue at the fishing grounds.' },
    { id: 'oakes', name: 'Ned Oakes', role: 'Boatman', survey: 0, forage: 1, guard: 1, tongue: 0, heal: 0, traits: ['waterman', 'nightowl'], note: 'Rowed the Thames for ten years. Happiest in a boat.' },
  ];

  const VOLUNTEERS = [
    { name: 'Walter Pym', occupation: 'Cooper' },
    { name: 'Susanna Leach', occupation: 'Midwife' },
    { name: 'Hugh Barrow', occupation: 'Plowman' },
    { name: 'Thomas Greave', occupation: 'Fowler' },
    { name: 'Joan Aldous', occupation: 'Weaver' },
    { name: 'Peter Kell', occupation: 'Sawyer' },
    { name: 'Richard Snow', occupation: 'Fisherman' },
    { name: 'Alice Deane', occupation: 'Herbwife' },
    { name: 'Nicholas Shute', occupation: 'Mason' },
    { name: 'Edward Lyle', occupation: 'Apprentice' },
  ];
  const VOL_SKILL = { Cooper: 'guard', Midwife: 'heal', Plowman: 'forage', Fowler: 'forage', Weaver: 'survey', Sawyer: 'guard', Fisherman: 'forage', Herbwife: 'heal', Mason: 'survey', Apprentice: 'tongue' };
  const VOL_TRAITS = ['devout', 'clumsy', 'greenhand', 'hardy', 'keeneyed', 'steady', 'homesick', 'nightowl', 'swimmer', 'glutton'];

  LF.makeVolunteers = function (r) {
    return LF.shuffle(VOLUNTEERS, r).slice(0, 3).map((v, k) => {
      const m = { id: 'vol' + k, name: v.name, role: 'Settler', occupation: v.occupation, survey: 0, forage: 0, guard: 0, tongue: 0, heal: 0, volunteer: true };
      m[VOL_SKILL[v.occupation]] = 1 + (r() < 0.3 ? 1 : 0);
      const tr = LF.shuffle(VOL_TRAITS, r);
      m.traits = [tr[0]];
      if (r() < 0.5) m.traits.push(tr[1]);
      m.note = `A ${v.occupation.toLowerCase()} from among the settlers. Volunteered to go ashore early.`;
      return m;
    });
  };

  // Gear a party can carry. Weight in pounds; each person carries 30.
  LF.CARRY = 30;
  LF.GEAR = {
    rations: { name: 'Rations', unit: 'ration', weight: 2, desc: 'A day’s food for one person.' },
    tools: { name: 'Iron tools', unit: 'bundle', weight: 4, desc: 'Hatchets and knives. The best gift and trade good.', trade: 3 },
    beads: { name: 'Glass beads', unit: 'string', weight: 1, desc: 'Light and cheap. Welcome, but they impress less.', trade: 1 },
    cloth: { name: 'Woolen cloth', unit: 'bolt', weight: 3, desc: 'Warm duffel cloth. Valued for trade.', trade: 2 },
    powder: { name: 'Powder and shot', unit: 'pouch', weight: 2, desc: 'For hunting and defense. Muskets are useless without it.' },
    medicine: { name: 'Medicines', unit: 'dose', weight: 1, desc: 'Bark for fevers, salves for wounds.' },
    compass: { name: 'Surveyor’s compass and chain', unit: 'set', weight: 8, desc: 'Keeps the party’s reckoning true. Only one aboard.', single: true },
    canoe: { name: 'Canoe', unit: 'canoe', weight: 45, desc: 'Travels rivers, lakes and shallows fast. Heavy to carry overland.', single: true },
    tent: { name: 'Oilcloth tent', unit: 'tent', weight: 8, desc: 'Keeps a party dry through storms.', single: true },
  };
  LF.GEAR_ORDER = ['rations', 'tools', 'beads', 'cloth', 'powder', 'medicine', 'compass', 'canoe', 'tent'];
  LF.START_STORES = { rations: 340, tools: 12, beads: 30, cloth: 10, powder: 18, medicine: 10, compass: 1, canoe: 1, tent: 2 };

  LF.PACES = {
    cautious: { name: 'Cautious', time: 1.35, err: 0.7, risk: 0.5, fatigue: 0.8, desc: 'Slower. Better maps, fewer accidents.' },
    steady: { name: 'Steady', time: 1, err: 1, risk: 1, fatigue: 1, desc: 'A sensible pace.' },
    forced: { name: 'Forced march', time: 0.75, err: 1.6, risk: 1.5, fatigue: 1.7, desc: 'Covers ground fast. Sloppy maps and worn-out people.' },
  };

  LF.ADVISORS = {
    harrow: { name: 'Giles Harrow', role: 'Quartermaster', initials: 'GH', wants: 'a sheltered harbor, fresh water and dry ground for the stores' },
    pryce: { name: 'Rev. Nathaniel Pryce', role: 'Chaplain', initials: 'NP', wants: 'healthy high ground, and keeping faith with the people here' },
    voss: { name: 'Edmund Voss', role: 'Company agent', initials: 'EV', wants: 'furs, timber and a harbor to ship them from' },
    quarles: { name: 'Capt. Miles Quarles', role: 'Militia captain', initials: 'MQ', wants: 'ground that can be defended, away from anyone hostile' },
    kemp: { name: 'Ruth Kemp', role: 'For the settlers', initials: 'RK', wants: 'good farmland close to the landing, and clean water' },
  };

  // Buildings for the founding plan. Labor in person-days, timber in loads.
  LF.BUILDINGS = {
    field: { name: 'Field', w: 1, h: 1, labor: 10, timber: 0, desc: 'Ten acres of crops. Open ground is quick to plant. Woods must be cleared first.' },
    house: { name: 'House', w: 1, h: 1, labor: 30, timber: 12, desc: 'Shelter for eight people. Nobody should face winter without one.' },
    storehouse: { name: 'Storehouse', w: 2, h: 1, labor: 50, timber: 25, desc: 'Keeps food dry. Without it, stores spoil.' },
    well: { name: 'Well', w: 1, h: 1, labor: 18, timber: 2, desc: 'Clean water. Unneeded beside a spring or river, if the ground allows.' },
    palisade: { name: 'Palisade', w: 1, h: 1, labor: 5, timber: 3, desc: 'A wall of sharpened logs. Drag to draw a rectangle.' },
    blockhouse: { name: 'Blockhouse', w: 1, h: 1, labor: 40, timber: 20, desc: 'A small fort. Holds off raids.' },
    meetinghouse: { name: 'Meetinghouse', w: 2, h: 1, labor: 45, timber: 22, desc: 'Church and council hall. Lifts spirits.' },
    dock: { name: 'Dock', w: 1, h: 1, labor: 35, timber: 18, water: true, desc: 'Must touch water. Better fishing and cargo loading.' },
    sawpit: { name: 'Sawpit', w: 1, h: 1, labor: 16, timber: 4, desc: 'Timber goes further, and sawn boards can be exported.' },
    kiln: { name: 'Brick kiln', w: 1, h: 1, labor: 25, timber: 6, needs: 'clay', desc: 'Needs clay nearby. Brick chimneys keep winter sickness down.' },
    mill: { name: 'Mill', w: 1, h: 1, labor: 70, timber: 25, needs: 'falls', desc: 'Needs falls on a river. Ground meal makes the harvest go further.' },
    smithy: { name: 'Smithy', w: 1, h: 1, labor: 30, timber: 10, desc: 'Keeps tools working. Uses bog iron if there is any.' },
    tradehouse: { name: 'Trading house', w: 1, h: 1, labor: 25, timber: 10, desc: 'Draws trade from friendly towns.' },
  };
  LF.BUILD_ORDER = ['field', 'house', 'storehouse', 'well', 'palisade', 'blockhouse', 'meetinghouse', 'dock', 'sawpit', 'kiln', 'mill', 'smithy', 'tradehouse'];

  // Everyone else aboard the Constant.
  LF.SETTLER_NAMES = [
    ['John Cole', 'Farmer'], ['Mercy Cole', 'Farmer'], ['Henry Bright', 'Farmer'], ['Anne Bright', 'Weaver'], ['Roger Tilney', 'Sawyer'],
    ['Margery Fox', 'Farmer'], ['Stephen Ware', 'Fisherman'], ['Luke Ware', 'Fisherman'], ['Grace Hollis', 'Midwife'], ['Isaac Penn', 'Blacksmith'],
    ['Edmund Crowe', 'Laborer'], ['Martha Crowe', 'Farmer'], ['Daniel Eyre', 'Laborer'], ['Prudence Eyre', 'Farmer'], ['Robert Nash', 'Carpenter'],
    ['Francis Hale', 'Laborer'], ['Katherine Lowe', 'Farmer'], ['George Sayer', 'Fowler'], ['Joan Sayer', 'Farmer'], ['Simon Baker', 'Baker'],
    ['Dorothy Baker', 'Farmer'], ['Thomas Hurst', 'Sawyer'], ['Ellen Hurst', 'Weaver'], ['Matthew Ring', 'Carpenter'], ['Agnes Ring', 'Farmer'],
    ['William Dyer', 'Laborer'], ['Christopher Mold', 'Mason'], ['Bridget Mold', 'Farmer'], ['Ralph Stone', 'Laborer'], ['Hester Grant', 'Farmer'],
  ];
})();
