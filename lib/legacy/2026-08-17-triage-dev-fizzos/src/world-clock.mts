/**
 * `@emsenn/fizzos/world-clock` — the world's own time, and the climate that turns on it.
 *
 * The world keeps a running clock on a single shared entity, advancing every tick. From it
 * fall, as **pure functions of world-time** (ν-type world cycles — coinductive, observed,
 * never "completed", Farstone `DESIGN.md` §4.6):
 *
 *   - the **phase** of day (dawn → day → dusk → night),
 *   - the **tide** (high/low, on a slower cycle),
 *   - the **season** (spring → summer → autumn → winter, turning at the solstices/equinoxes),
 *   - and **growing season** (spring & summer), which the biome couples to.
 *
 * **Weather** is the one stochastic cycle: a **seed-based, season-conditioned, replayable
 * Markov chain** over five states (clear, cloudy, rain, storm, fog), with **dry-streak**
 * tracking for fire-watch (`world/biome.md`). It is *repeatable yet nondeterministic*: keyed
 * on a world seed and the clock, the same log replays to the same skies every time — so the
 * weather is honest under the DESIGN's "replay is exact" while still feeling unforeseeable to
 * a player. There is **no `Math.random` here**: a world that cannot be replayed is not this
 * world. The transition matrix is *content* — a game hands the engine its own climate.
 */
import { type Fact, type World, numberOf, tell, valueOf } from "./world.mjs";

/** The shared entity that carries the world clock. */
export const WORLD = "the-world";
/** Ticks per phase of day. */
export const PHASE_LEN = 30;

export const PHASES = ["dawn", "day", "dusk", "night"] as const;
export type Phase = (typeof PHASES)[number];

/** Ticks in a full day (one turn of all four phases). */
export const DAY_LEN = PHASE_LEN * PHASES.length;
/** Days in a season; a playable coarsening of the biome's ~90 astronomical days. */
export const SEASON_DAYS = 7;
/** Ticks in a season. */
export const SEASON_LEN = DAY_LEN * SEASON_DAYS;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** The five-state maritime weather, in canonical order (the Markov index order). */
export const WEATHERS = ["clear", "cloudy", "rain", "storm", "fog"] as const;
export type Weather = (typeof WEATHERS)[number];

export const worldTime = (w: World): number => numberOf(w, WORLD, "world-time", 0);
export const phaseOf = (w: World): Phase => PHASES[Math.floor(worldTime(w) / PHASE_LEN) % PHASES.length]!;
export const tideOf = (w: World): "high" | "low" => (Math.floor(worldTime(w) / (PHASE_LEN * 2)) % 2 === 0 ? "high" : "low");

/** The season at an arbitrary world-time — a pure ν-cycle of the clock. */
export const seasonAt = (t: number): Season => SEASONS[Math.floor(t / SEASON_LEN) % SEASONS.length]!;
export const seasonOf = (w: World): Season => seasonAt(worldTime(w));
/** Spring and summer are the growing season — the biome couples crops, clams, and trade to it. */
export const growingSeasonOf = (w: World): boolean => seasonOf(w) === "spring" || seasonOf(w) === "summer";

export const weatherOf = (w: World): Weather => (valueOf(w, WORLD, "weather") as Weather | null) ?? "clear";
/** Consecutive dry phases (no rain/storm) — the fire-watch couples to this. */
export const dryStreakOf = (w: World): number => numberOf(w, WORLD, "dry-streak", 0);
/** Foul weather for the working waterfront: rain or storm closes nets, sailings, and tempers. */
export const isFoul = (wx: Weather): boolean => wx === "rain" || wx === "storm";

/** Whether the clock crosses into a new phase on the next tick (weather rolls at the crossing). */
export const phaseChangesAt = (w: World): boolean => (worldTime(w) + 1) % PHASE_LEN === 0;

// ── the deterministic substrate ────────────────────────────────────────────────

/** The replay seed the climate (and every other seeded roll) hangs off; 1 unless seeded. */
export const worldSeed = (w: World): number => numberOf(w, WORLD, "world-seed", 1);

const mix = (h: number): number => {
  let x = h | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/**
 * A pure, well-distributed roll in `[0, 1)` from a list of integer keys — the world's only
 * source of chance. Keyed on the seed and the clock (and an actor, a cell, …), it makes every
 * "random" outcome a *function of the log*, so a replay reproduces it exactly.
 */
export const rngFor = (...keys: readonly number[]): number => {
  let s = 0x811c9dc5;
  for (const k of keys) s = Math.imul(s ^ (k | 0), 0x01000193);
  return mix(s);
};

/** A cheap stable integer hash of a string, for keying rolls on an actor or cell id. */
export const hashStr = (s: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
};

// ── weather as a season-conditioned Markov chain ────────────────────────────────

/** Transition weights from one weather to each next weather (need not be normalized). */
export type WeatherRow = Readonly<Partial<Record<Weather, number>>>;
/** For one season, the row out of each current weather. */
export type SeasonWeather = Readonly<Record<Weather, WeatherRow>>;
/** The full climate: a transition matrix per season. The unit of weather *content*. */
export type WeatherModel = Readonly<Record<Season, SeasonWeather>>;

/** Sample the next weather from the model's row, using a uniform roll `r ∈ [0,1)`. */
export function stepWeather(current: Weather, season: Season, model: WeatherModel, r: number): Weather {
  const row = model[season][current];
  let total = 0;
  for (const wx of WEATHERS) total += row[wx] ?? 0;
  if (total <= 0) return current;
  const target = r * total;
  let acc = 0;
  for (const wx of WEATHERS) {
    acc += row[wx] ?? 0;
    if (target < acc) return wx;
  }
  return current;
}

/**
 * A temperate-maritime default climate, so the bare engine has honest skies. A game overrides
 * it with its own matrix (Farstone hands over the cool-Atlantic climate of `world/biome.md`).
 * Rows are unnormalized weights; persistence (a weather tends to hold) lives on the diagonal.
 */
export const DEFAULT_WEATHER: WeatherModel = Object.freeze(
  Object.fromEntries(
    SEASONS.map((s) => [
      s,
      {
        clear: { clear: 5, cloudy: 3, fog: 1 },
        cloudy: { clear: 3, cloudy: 4, rain: 2, fog: 1 },
        rain: { cloudy: 3, rain: 3, storm: 1 },
        storm: { rain: 3, storm: 1, cloudy: 2 },
        fog: { fog: 2, clear: 3, cloudy: 2 },
      } satisfies SeasonWeather,
    ]),
  ) as Record<Season, SeasonWeather>,
);

/**
 * Advance the clock one tick. At a phase boundary the weather takes one Markov step under the
 * season's row, seeded deterministically on `(world-seed, world-time)` — never `Math.random` —
 * and the dry-streak grows on a dry phase or resets on rain/storm (fog holds it). Phase, tide,
 * and season need no writing: they are pure functions of the world-time the tick advances.
 */
export function advanceClock(w: World, model: WeatherModel = DEFAULT_WEATHER): World {
  const next = worldTime(w) + 1;
  const facts: Fact[] = [{ e: WORLD, a: "world-time", v: String(next) }];
  if (next % PHASE_LEN === 0) {
    const wx = stepWeather(weatherOf(w), seasonAt(next), model, rngFor(worldSeed(w), next));
    facts.push({ e: WORLD, a: "weather", v: wx });
    const dry = wx === "rain" || wx === "storm" ? 0 : wx === "fog" ? dryStreakOf(w) : dryStreakOf(w) + 1;
    facts.push({ e: WORLD, a: "dry-streak", v: String(dry) });
  }
  return tell(w, facts);
}

/** A human reading of the world's current season, time, weather, and tide. */
export const timeReport = (w: World): string =>
  `It is ${phaseOf(w)} of a ${seasonOf(w)} day over Farstone. The weather is ${weatherOf(w)}; the tide runs ${tideOf(w)}.`;
