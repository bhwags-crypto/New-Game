# Landfall

A colonial founding game. You start as the leader of a colony looking at an unknown coast, not as a god looking down at a map. You scout the land, draw a chart that may be wrong, pick a site, lay out a town and try to keep everyone alive until the supply ship returns.

## How a game goes

1. **The landing (40 days).** The ship waits forty days. Every day the settlers stay aboard costs food and planting time. Five officers each ask you to find something: furs, a bluff, farmland, a spring, peace with a town. Doing it earns their loyalty.
2. **Expeditions.** Pick 2 to 5 people from 14 crew and volunteers. Each has skills and traits (Keen-eyed, Glutton, Hothead, Homesick and more). Pack gear against a weight limit: food, trade goods, powder, medicine, a compass, a canoe, a tent. Choose a pace.
3. **In the field.** You see the true land only as far as the party can see. A clock runs from dawn to dusk. After dark the party sees little, draws badly and gets hurt. Each night opens a camp screen where you choose the fire, the rations and each person's task: keep watch, hunt, fish, gather, redraw the day's notes, tend the sick or pray. Weather, fever, bears, thieves, flooded rivers, snakebite and quarrels all happen out there.
4. **The chart can be wrong.** Weak or rushed surveys mislabel ground. Doubtful areas are drawn in red ink. Without a surveyor or compass the party's position drifts, so whole areas get drawn in the wrong place, and stakes too. Old information fades. Notes only reach the chart if the party makes it back.
5. **The land.** Twelve kinds of ground, rivers and lakes, and things to find up close: springs, clay, building stone, salt licks, beaver ponds, falls for a mill, fords, bluffs, berry thickets, bog iron, burial grounds, an old wreck and an empty town.
6. **The towns.** Four towns, each with its own economy, memory and rivalries. How you approach them matters. Friendly towns trade, describe the land, lend a guide and ask you not to settle on their hunting grounds. They remember broken promises and robbed graves.
7. **The council.** Five officers argue for different sites, using only the chart. You can put a limited number of questions to your scouts, translator, hunter and physician, whose answers draw on what they really saw. Overruling people costs loyalty, and loyalty matters later.
8. **The town plan.** Lay out fields, houses, a storehouse, a well, a palisade and more on the chart of your site. Then go ashore and see the real ground. Buildings planned on marsh or water are blocked. Fields planned on "meadow" may turn out to be woods.
9. **The first year.** Run the colony in two-week turns until next May. Assign work (or let the quartermaster do it), build, plant before mid-June, harvest in September, lay in firewood and get everyone under a roof before winter. Fever, the flux, winter sickness, raids, fires, a hurricane, births and visitors all happen along the way.
10. **The ending.** The supply ship grades your cargo. Then the reveal shows the land as it really was, what your chart got wrong, and where the best ground on the coast actually was.

## Running it

Open `index.html` in a browser. There is no build step and no dependencies. Fonts load from Google Fonts, with fallbacks.

## Code

- `js/core.js`: constants, terrain and feature tables, random numbers, noise, text and calendar helpers.
- `js/world.js`: generates the true land, rivers, features, towns and the landing.
- `js/data.js`: crew, traits, gear, paces, officers, buildings and settlers.
- `js/chart.js`: draws the hand-made chart. It reads only what the colonists believe.
- `js/field.js`: draws the true land around the party, with daylight and firelight.
- `js/local.js`: builds and draws the town-scale map of a site, believed or true.
- `js/game.js`: game state, the knowledge model, the landing camp and the interface shell.
- `js/expedition.js`: outfitting, movement, nights in camp, field events and first contact.
- `js/council.js`: site reports, the officers' arguments and questions.
- `js/founding.js`: the town plan, going ashore and the first-year simulation.
- `js/epilogue.js`: the ending, site ranking and the reveal.
