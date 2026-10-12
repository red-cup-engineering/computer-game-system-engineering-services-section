/**
 * `@emsenn/fizzos/farstone-game` — Farstone as a parameterization of the FizzOS engine.
 *
 * Everything here is Farstone-specific and lives OUTSIDE the engine core: the ecology closure
 * rules its waters settle under, and the pollution field that diffuses across the open sea.
 * The engine runs these because Farstone hands them over, not because the engine knows what
 * "pollution" or "blight" are. A different game would hand over different rules and fields.
 */
import type { ClosureRule } from "./predication.mjs";
import type { FieldSpec, GameContext, GameDefinition } from "./game.mjs";
import type { SeasonWeather, WeatherModel } from "./world-clock.mjs";
import { FARSTONE_CLIMATE_FUNCTIONAL, FARSTONE_CLIMATE_SYSTEMS, almanac } from "./farstone-climate.mjs";
import { FARSTONE_DIRECTOR_FUNCTIONAL, farstoneDirector, stormRecovery } from "./director.mjs";
import { DEPTHS_FUNCTIONAL, DEPTHS_SYSTEMS } from "./depths.mjs";
import { inspect, petition } from "./farstone-arcs.mjs";

/** Pollution at or above this fouls a cell. */
const BLIGHT_POLLUTION = 6;

/**
 * Farstone's standing closure rules — fired to a fixpoint each tick. A polluted cell blights;
 * clean water heals; a blighted cell that still teems is `torn` (its own predicates pull both
 * ways). Rules-as-data over fibers: a different game adds its own world-logic this way.
 */
const FARSTONE_RULES: readonly ClosureRule[] = Object.freeze([
  { id: "blight", when: (f) => f.number("pollution", 0) >= BLIGHT_POLLUTION && f.value("blighted") !== "true",
    then: (f) => [{ e: f.id, a: "blighted", v: "true" }] },
  { id: "heal", when: (f) => f.number("pollution", 0) < BLIGHT_POLLUTION && f.value("blighted") === "true",
    then: (f) => [{ e: f.id, a: "blighted", v: "false" }] },
  { id: "torn", when: (f) => f.value("blighted") === "true" && f.number("fish-stock", 0) > 0 && f.value("torn") !== "true",
    then: (f) => [{ e: f.id, a: "torn", v: "true" }] },
]);

/**
 * Farstone's climate: the cool-Atlantic maritime band of `world/biome.md`. Rows are
 * unnormalized transition weights to the next weather; a high diagonal makes a sky tend to
 * hold. Summer is settled and fog-prone, with the occasional remnant-tropical storm; autumn
 * is dominated by Atlantic frontal systems (storm/rain); winter is grey and wet under the NW
 * wind; spring clears slowly out of fog and rain. Seeded and replayable — see the world-clock.
 */
const seasonWeather = (rows: SeasonWeather): SeasonWeather => Object.freeze(rows);

export const FARSTONE_WEATHER: WeatherModel = Object.freeze({
  spring: seasonWeather({
    clear: { clear: 4, cloudy: 3, fog: 2 },
    cloudy: { clear: 3, cloudy: 3, rain: 3, fog: 2 },
    rain: { cloudy: 3, rain: 3, clear: 1 },
    storm: { rain: 3, cloudy: 2, storm: 1 },
    fog: { fog: 3, cloudy: 2, clear: 3 },
  }),
  summer: seasonWeather({
    clear: { clear: 7, cloudy: 2, fog: 2 },
    cloudy: { clear: 4, cloudy: 3, rain: 1, fog: 1 },
    rain: { cloudy: 3, clear: 2, rain: 1, storm: 1 },
    storm: { rain: 2, cloudy: 3, clear: 1 },
    fog: { clear: 5, fog: 2, cloudy: 1 },
  }),
  autumn: seasonWeather({
    clear: { clear: 3, cloudy: 4, fog: 1 },
    cloudy: { cloudy: 3, rain: 3, storm: 2, clear: 1 },
    rain: { rain: 3, storm: 3, cloudy: 2 },
    storm: { storm: 3, rain: 3, cloudy: 2 },
    fog: { fog: 2, cloudy: 3, rain: 1 },
  }),
  winter: seasonWeather({
    clear: { clear: 2, cloudy: 5, fog: 1 },
    cloudy: { cloudy: 4, rain: 3, storm: 2, clear: 1 },
    rain: { rain: 3, cloudy: 3, storm: 2 },
    storm: { storm: 2, rain: 3, cloudy: 3 },
    fog: { fog: 1, cloudy: 4, rain: 1 },
  }),
});

/** Farstone's fields: pollution diffuses across the connected open water. */
const FARSTONE_FIELDS: readonly FieldSpec[] = Object.freeze([
  { name: "pollution", overTag: "ocean", predicate: "pollution", rate: 0.15 },
]);

/** Farstone, as a game the engine can run. */
export const FARSTONE_GAME: GameDefinition = Object.freeze({
  name: "farstone",
  worldRules: FARSTONE_RULES,
  fields: FARSTONE_FIELDS,
  weather: FARSTONE_WEATHER,
  systems: [...FARSTONE_CLIMATE_SYSTEMS, farstoneDirector, stormRecovery, ...DEPTHS_SYSTEMS],
  functional: [...FARSTONE_CLIMATE_FUNCTIONAL, ...FARSTONE_DIRECTOR_FUNCTIONAL, ...DEPTHS_FUNCTIONAL, "decision-status"],
  commands: { almanac, forecast: almanac, petition, audit: inspect, recheck: inspect, reinspect: inspect },
  ecology: { tag: "ocean" },
  genre: true,
  onLoad: seedFarstoneSituation,
});

/**
 * Seed the off-season's standing situation (lore.md §"The Off-Season"): the **dredging permit
 * dispute** as a genuine paraconsistent ⊤. The clerk's office holds Application 23 as *both*
 * within its decision window and overdue — affirmed and denied at once — so the cell settles to
 * `stable` and the world *carries* the contradiction rather than resolving it. The two feuding
 * fishers each hold that contested conviction, which `regard`, dialogue, and the Cabinet read.
 * Idempotent and content-tolerant: it fires only for entities the loaded bible actually contains.
 */
function seedFarstoneSituation(ctx: GameContext): void {
  const has = (id: string) => ctx.things().includes(id) || ctx.rooms().includes(id);
  // The permit is held in two minds at once. Each fisher's *belief* about it settles to the
  // paraconsistent ⊤ by the knowledge-join (the engine's honest mechanism for a held contradiction)
  // — the contested conviction the Cabinet, dialogue, and `regard` read off them. The clerk's office
  // carries the dispute as a plain settled status the world does not resolve away.
  // Idempotent / restore-safe: only seed a dispute that is not already on the board, so a world
  // restored mid-arc (or seeded by a test) keeps the state the player already moved it to.
  if (ctx.value("the-dredging-permit", "decision-status") === null) ctx.tell([{ e: "the-dredging-permit", a: "decision-status", v: "contested" }]);
  for (const fisher of ["coilin-vey", "brannaugh-ross"]) {
    if (has(fisher) && ctx.value(fisher, "belief:dredging-permit") === null) ctx.tell([{ e: fisher, a: "belief:dredging-permit", v: "stable" }]);
  }
  // The Hydrant-23 water-quality dispute (biome.md): a contested ⊤, precautionary boil-water advisory
  // until re-inspected. The mundane civic contradiction the world holds — governance played straight.
  if (ctx.value("hydrant-23", "water-quality") === null) {
    ctx.tell([
      { e: "hydrant-23", a: "water-quality", v: "contested" },
      { e: "hydrant-23", a: "advisory", v: "boil-water" },
    ]);
  }
}
