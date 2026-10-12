// needing — the LIVING reading of an npc: its needs, its mood, and the one need pressing
// hardest on it right now. `needing/` nests under `observing/` as a sibling of `look` and
// `affording`: it changes nothing, it is a QUOTE of how the npc is doing, read off the npc's
// own settled fiber. The decide() move (responding/deciding) chooses FROM this reading.
//
// Tynan-Sylvester reading: an npc is a bundle of NEEDS that decay, and the story is the npc
// pursuing its most pressing need through a scarce world. Here we only READ the state:
//   - levels  : each need:* cell as an integer 0..100 (higher = more satisfied).
//   - mood    : how satisfied the needs are overall — mean(levels)/100 in [0,1] — blended with
//               trait modifiers (a `gloomy` trait lowers it, `cheerful` raises it) and a penalty
//               for contested beliefs (the count of ⊤ cells in the fiber, via closure).
//   - band    : content / strained / breaking, by mood thresholds (0.5 / 0.25).
//   - pressing: the need with the LOWEST level (the crisis the npc must act on), or null if all
//               needs are at the comfortable ceiling. Deterministic tie-break by NEED order.
//
// Pure: needs(thing) reads only the settled fiber + closure (no disk, no RNG, no Date).
// needsOf(root, subject) settles the subject (need:* and trait:* superseding to latest) first.
//
// needs(thing) -> { levels:{hunger,rest,recreation}, mood:Number, band, pressing }
// needsOf(root, subject) = needs(await settle(root, subject, { functional: NEED_FUNCTIONAL })).

import closure from "#closure";
import { settle, FUNCTIONAL } from "#substrate";

// The needs we track, in deterministic order (also the tie-break order for `pressing`).
export const NEEDS = ["hunger", "rest", "recreation"];

// DECAY — per-tick drop for each need (hunger fastest). A need at 0 is a crisis. These are the
// rates the tick applies via `decayed`; exported so the tick can wire decay deterministically.
export const DECAY = { hunger: 4, rest: 2, recreation: 1 };

// The comfortable ceiling: at this level a need is satisfied and not pressing.
const SATISFIED = 80;

// Trait modifiers on mood, added after the needs mean. Deterministic, additive, clamped.
const TRAIT_MOOD = { gloomy: -0.15, cheerful: +0.15, content: +0.1, anxious: -0.1 };

// Per-contested-belief mood penalty (a fiber the world still argues weighs on the npc).
const CONTESTED_PENALTY = 0.05;

// Mood bands by threshold (content ≥ 0.5 > strained ≥ 0.25 > breaking).
const BAND = (mood) => (mood >= 0.5 ? "content" : mood >= 0.25 ? "strained" : "breaking");

// decayed — the pure decay step: drop a need level by `rate`, clamped to [0,100]. Integer in,
// integer out, no RNG. This is the function the tick folds over each need every tick.
export function decayed(level, rate) {
  const n = Math.trunc(Number(level));
  const r = Math.trunc(Number(rate));
  const next = n - r;
  return next < 0 ? 0 : next > 100 ? 100 : next;
}

// levelOf — read one need:* level off a settled fiber as an integer 0..100. Absent ⇒ 100
// (a need never asserted is, by convention, fully satisfied — it isn't pressing on the npc).
function levelOf(thing, need) {
  const pred = `need:${need}`;
  let best = null;
  for (const c of thing.fiber) {
    if (c.predicate !== pred) continue;
    if (c.value.pos !== 1) continue; // only an asserted level counts
    const n = Math.trunc(Number(c.object));
    if (Number.isNaN(n)) continue;
    // If the fiber carries more than one asserted level (un-superseded history), the HIGHER
    // integer object wins deterministically; needsOf settles need:* as functional so normally
    // exactly one survives.
    if (best === null || n > best) best = n;
  }
  return best === null ? 100 : best < 0 ? 0 : best > 100 ? 100 : best;
}

// traitMoodOf — sum the mood modifiers of every `trait` cell the npc holds (gloomy/cheerful/…).
function traitMoodOf(thing) {
  let delta = 0;
  for (const c of thing.fiber) {
    if (c.predicate !== "trait") continue;
    if (c.value.pos !== 1) continue;
    delta += TRAIT_MOOD[c.object] ?? 0;
  }
  return delta;
}

export default function needs(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("needs: thing must be a settled being { entity, fiber }");
  }

  const levels = {};
  for (const need of NEEDS) levels[need] = levelOf(thing, need);

  // mood: mean of need levels in [0,1], plus trait modifiers, minus a contested-belief penalty.
  const mean = NEEDS.reduce((s, n) => s + levels[n], 0) / (NEEDS.length * 100);
  const { contested } = closure(thing);
  let mood = mean + traitMoodOf(thing) - CONTESTED_PENALTY * contested;
  if (mood < 0) mood = 0;
  if (mood > 1) mood = 1;

  // pressing: the LOWEST need below the satisfied ceiling; null if none press. Tie-break by
  // NEEDS order (hunger first), which is deterministic.
  let pressing = null;
  let lowest = Infinity;
  for (const need of NEEDS) {
    const lvl = levels[need];
    if (lvl >= SATISFIED) continue;
    if (lvl < lowest) {
      lowest = lvl;
      pressing = need;
    }
  }

  return { levels, mood, band: BAND(mood), pressing };
}

// NEED_FUNCTIONAL — the substrate's functional set PLUS each need:* and trait, so settling an
// npc supersedes need history to the latest level (decay leaves a trail of appends).
export const NEED_FUNCTIONAL = new Set([...FUNCTIONAL, ...NEEDS.map((n) => `need:${n}`)]);

export async function needsOf(root, subject) {
  return needs(await settle(root, subject, { functional: NEED_FUNCTIONAL }));
}

// satisfies — does a SETTLED resource thing provide this need? A resource has a `provides` cell
// whose object is the need predication (e.g. `need:hunger`). `need` may be a bare need name
// ("hunger") or the full predication ("need:hunger"). Pure read of the resource's fiber.
export function satisfies(resourceThing, need) {
  if (!resourceThing || !Array.isArray(resourceThing.fiber)) return false;
  const want = String(need).startsWith("need:") ? String(need) : `need:${need}`;
  return resourceThing.fiber.some(
    (c) => c.predicate === "provides" && c.value.pos === 1 && c.object === want,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, npc] = process.argv.slice(2);
  if (!world || !npc) {
    console.error("usage: node needs.mjs <world> <npc>");
    process.exit(2);
  }
  console.log(JSON.stringify(await needsOf(world, npc)));
}
