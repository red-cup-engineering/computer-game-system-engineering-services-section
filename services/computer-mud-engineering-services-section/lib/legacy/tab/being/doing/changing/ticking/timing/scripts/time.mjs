// time — the calendar derived from the heartbeat. `timing/` nests under `ticking/` because the
// clock is the world reading its OWN tick count as a day/hour/season/phase: nothing stored but the
// integer tick, everything else a PURE function of it. This is what makes day/night MATTER — once
// the world knows it is night, rest decays faster (you tire when you should be sleeping), and once
// it knows the season, the ecology can lean on it. Time is not flavour; it is an input the rest of
// the loop reads.
//
// The calendar (deterministic, no Date, no RNG — derived entirely from the integer tick):
//   HOURS_PER_DAY = 24, DAYS_PER_SEASON = 30, SEASONS_PER_YEAR = 4 (so a year is 120 days).
//   hour   = tick mod 24            (0..23)
//   day    = floor(tick / 24)       (0..; absolute day count since tick 0)
//   season = floor(day / 30) mod 4  → spring | summer | autumn | winter
//   phase  = dawn (5..7) | day (8..18) | dusk (19..21) | night (22..4)
// tick 0 is hour 0 of day 0 of spring — midnight at the start of the world.
//
// clock(tick) -> { day, hour, season, phase, year, dayOfSeason }                      (PURE)
// timeRows({ dimension, tick, t }) -> [ {e,a,v,t} ]   day/hour/season/phase on the dimension.
// needRateAt(need, phase, season) -> rate   time modulates a need's decay (rest faster at night…).

const HOURS_PER_DAY = 24;
const DAYS_PER_SEASON = 30;
const SEASONS_PER_YEAR = 4;
const DAYS_PER_YEAR = DAYS_PER_SEASON * SEASONS_PER_YEAR;

export const SEASONS = ["spring", "summer", "autumn", "winter"];
export const PHASES = ["dawn", "day", "dusk", "night"];

// phaseOf — the part of day for an hour, by fixed bands. Pure. dawn 5–7, day 8–18, dusk 19–21,
// night 22–4 (wraps midnight). The bands are the same every day, every season — deterministic.
export function phaseOf(hour) {
  const h = ((Math.trunc(Number(hour)) % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  if (h >= 5 && h <= 7) return "dawn";
  if (h >= 8 && h <= 18) return "day";
  if (h >= 19 && h <= 21) return "dusk";
  return "night"; // 22, 23, 0..4
}

// clock — derive the whole calendar from the integer tick. Pure: tick in, calendar out, nothing
// read from the wall clock. Negative or non-integer ticks are clamped to a non-negative integer.
export default function clock(tick) {
  const n = Math.max(0, Math.trunc(Number(tick) || 0));
  const hour = n % HOURS_PER_DAY;
  const day = Math.floor(n / HOURS_PER_DAY);
  const dayOfYear = day % DAYS_PER_YEAR;
  const year = Math.floor(day / DAYS_PER_YEAR);
  const seasonIndex = Math.floor(dayOfYear / DAYS_PER_SEASON) % SEASONS_PER_YEAR;
  const season = SEASONS[seasonIndex];
  const dayOfSeason = dayOfYear % DAYS_PER_SEASON;
  const phase = phaseOf(hour);
  return { day, hour, season, phase, year, dayOfSeason };
}

// timeRows — the rows the tick writes so the calendar is READABLE off the dimension's own fiber
// (day/hour/season/phase). `phase` is already FUNCTIONAL in the substrate; `season`/`day`/`hour`
// are single-valued readings too, superseding by latest-t. Pure: builds rows, appends nothing.
export function timeRows({ dimension, tick, t } = {}) {
  if (dimension == null || tick == null || t == null) {
    throw new TypeError("timeRows: dimension, tick, t are required");
  }
  const { day, hour, season, phase } = clock(tick);
  return [
    { e: dimension, a: "day", v: day, t },
    { e: dimension, a: "hour", v: hour, t },
    { e: dimension, a: "season", v: season, t },
    { e: dimension, a: "phase", v: phase, t },
  ];
}

// PHASE_NEED_FACTOR — how each part of day scales a need's decay. The story beat: rest decays
// FASTER at night (you tire when you should be asleep) and SLOWER in the day; recreation the
// inverse (boredom presses in the long day, eases at night); hunger is roughly flat (the body
// always burns). A factor of 1 is the baseline rate from #needing's DECAY.
const PHASE_NEED_FACTOR = {
  rest: { dawn: 1, day: 0.5, dusk: 1, night: 2 },
  recreation: { dawn: 1, day: 1.5, dusk: 1, night: 0.5 },
  hunger: { dawn: 1, day: 1, dusk: 1, night: 1 },
};

// SEASON_NEED_FACTOR — a gentler seasonal modulation: winter bites (hunger decays faster — the
// body burns to stay warm), summer eases it. Multiplied on top of the phase factor.
const SEASON_NEED_FACTOR = {
  hunger: { spring: 1, summer: 0.75, autumn: 1, winter: 1.5 },
};

// needRateAt — the time-modulated decay rate for a need, given the base rate and the current
// phase/season. PURE and deterministic. The tick calls this instead of the flat DECAY[need], so
// day and night (and the turning year) actually change how fast the actors tire and hunger.
//   needRateAt(need, phase, season, baseRate) -> integer rate (>= 0; rounded; at least 1 if base>0)
export function needRateAt(need, phase, season, baseRate = 1) {
  const base = Math.trunc(Number(baseRate)) || 0;
  if (base <= 0) return 0;
  const pf = PHASE_NEED_FACTOR[need]?.[phase] ?? 1;
  const sf = SEASON_NEED_FACTOR[need]?.[season] ?? 1;
  const scaled = Math.round(base * pf * sf);
  return scaled < 1 ? 1 : scaled; // a decaying need always decays by at least 1 when modulated
}

// CLI: node time.mjs <tick>
if (import.meta.url === `file://${process.argv[1]}`) {
  const [tick] = process.argv.slice(2);
  if (tick === undefined) {
    console.error("usage: node time.mjs <tick>");
    process.exit(2);
  }
  console.log(JSON.stringify(clock(Number(tick))));
}
