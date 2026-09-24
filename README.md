# Landfall

A proof of concept for a colonial founding game. The player starts as a colony leader looking at an unknown coast, instead of as a god looking down at a map.

This build covers the scouting and site-selection half of the design:

1. **Outfit an expedition.** Pick 2 to 4 crew members. Each one brings a skill: surveying, foraging, guarding, translating or healing. Whoever goes can't forage at camp, and the food they carry comes out of the stores.
2. **Walk the land.** In the field you see the true terrain, but only as far as the party can see. Food limits how far the party can go.
3. **The chart can be wrong.** At the map table you only ever see the hand-drawn chart. Unskilled or rushed surveys mislabel ground (a "meadow" that is really swamp), and without a surveyor the party's sense of distance drifts, so whole areas get drawn in the wrong place. Old information fades over time. Field notes only go onto the chart if the party makes it back.
4. **First contact.** Native towns are met in the field. How you approach them (openly, with gifts, under arms, or not at all) and whether you have a translator sets the relationship. Friendly towns share what they know about the land and ask you not to settle on their hunting grounds. They remember whether you kept that promise.
5. **The council.** You choose a site from the stakes you planted, using only what the chart says. Three officers push for different priorities: the harbor, the high ground, or exports.
6. **The first year.** A written epilogue plays out the first year using the *true* land around your site. Then the reveal shows where the chart was wrong.

## Running it

Open `index.html` in a browser. There is no build step and no dependencies. Fonts load from Google Fonts, with fallbacks if they're unavailable.

## Code

- `js/world.js` generates the true land: terrain, rivers, game, native towns and the landing site.
- `js/chart.js` draws the colony's hand-made chart. It only reads what the colonists believe, never the true world.
- `js/field.js` draws the true land around the party.
- `js/game.js` holds the game state, rules, council, epilogue and interface.
