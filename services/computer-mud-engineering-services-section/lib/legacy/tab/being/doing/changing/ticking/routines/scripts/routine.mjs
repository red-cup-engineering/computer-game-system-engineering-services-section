// routines — NPCs keep a DAILY SCHEDULE, so the world gets a rhythm. `routines/` nests under
// `ticking/` because a routine is a pure TICK-RULE the world applies to its movers: each tick it
// reads the clock, looks up where each NPC is SUPPOSED to be at this hour, and walks it one hop
// closer. Without this the NPCs only chase needs (deciding/) or wander; WITH it the baker is at the
// market at nine and home by dusk, the guard walks his round, and the day has a shape an onlooker
// can read. It is the half of NPC life that is APPOINTMENT rather than appetite — a scripted place
// to be, advanced toward deterministically, one room per tick, the same way decide.mjs walks an
// actor toward the resource it needs.
//
// THE SCHEDULE. An NPC bears sparse `routine:<hour>` cells (object = a destination AREA id), e.g.
// routine:9 = "market-area", routine:18 = "home-area". The schedule is CYCLIC over the 24-hour day:
// the ACTIVE destination at the current hour is the entry for the GREATEST hour ≤ the current hour;
// if no entry is ≤ the current hour, it WRAPS to the greatest-hour entry (yesterday's last posting
// still stands until the first posting of today). So with {9, 18}: hours 9..17 → market, hours 18..23
// → home, and hours 0..8 → home as well (wrapping back to the 18 entry). An NPC with no routine:*
// cell has no schedule and is never moved by this rule.
//
// THE MOVE. tickRoutines reads the HOUR (from the explicit param, else from #timing — the dimension's
// `hour` cell, else derived from its `tick` via clock). For each mover that HAS a routine and is NOT
// already at its active destination, it does ONE deterministic BFS hop over `exit-*` from the NPC's
// current area toward that destination (the first step on a shortest path) and files a `located-in`
// change attributed to the NPC (agent = the npc). Determinism mirrors decide.mjs: exits and frontier
// are expanded in sorted order, so a world replays to one move. No Date, no RNG.
//
// scheduleOf(root, id)            -> { <hour:number>: <area> }  the NPC's sparse routine map
// destinationFor(root, id, hour)  -> <area> | null              the active destination this hour
// atDestination(root, id, hour?)  -> boolean                    is the NPC already at it (no dest → false)
// tickRoutines(root, t, hour?)    -> { appended:[row], moved:[{id, toward, hop}] }   (DEFAULT export)

import { rowsFor, subjects, locationOf } from "#substrate";
import changing from "#changing";
import clock from "#timing";

// The world dimension that carries the heartbeat/calendar (matches ticking.mjs's DIMENSION).
const DIMENSION = "farstone";

// latest — the latest-t functional value of a predicate on an entity's own trace (or fallback).
async function latest(root, entity, predicate, fallback = null) {
  let best = null;
  for (const r of await rowsFor(root, entity)) {
    if (r.e !== entity || r.a !== predicate || r.v === null) continue;
    if (best === null || r.t > best.t) best = r;
  }
  return best ? best.v : fallback;
}

// exitsOf — an area's walkable neighbours: {dir → dest} from its `exit-*` cells, latest-wins per
// direction, sorted by direction (then dest) so BFS expansion is deterministic. Mirrors decide.mjs.
async function exitsOf(root, area) {
  const byDir = new Map();
  for (const r of await rowsFor(root, area)) {
    if (r.e !== area || !r.a.startsWith("exit-") || r.v === null) continue;
    const dir = r.a.slice(5);
    const cur = byDir.get(dir);
    if (cur === undefined || r.t > cur.t) byDir.set(dir, { dest: r.v, t: r.t });
  }
  return [...byDir.entries()]
    .map(([dir, { dest }]) => ({ dir, dest }))
    .sort((a, b) => (a.dir < b.dir ? -1 : a.dir > b.dir ? 1 : a.dest < b.dest ? -1 : 1));
}

// scheduleOf — the NPC's sparse routine map { hour(number) → area }, read off `routine:<hour>` cells
// (latest-wins per hour). A bare read; the keys are the hours the NPC has a posting for. Pure.
export async function scheduleOf(root, id) {
  const byHour = new Map(); // hour → { area, t }
  for (const r of await rowsFor(root, id)) {
    if (r.e !== id || r.v === null || !r.a.startsWith("routine:")) continue;
    const hour = Number(r.a.slice("routine:".length));
    if (!Number.isInteger(hour)) continue;
    const cur = byHour.get(hour);
    if (cur === undefined || r.t > cur.t) byHour.set(hour, { area: r.v, t: r.t });
  }
  const out = {};
  for (const [hour, { area }] of byHour) out[hour] = area;
  return out;
}

// activeHour — given the schedule's posted hours and the current hour, the hour-key whose posting is
// active: the GREATEST posted hour ≤ current, else (none ≤ current) the GREATEST posted hour overall
// (the cyclic wrap — last posting of the day carries through midnight). null when the schedule is empty.
function activeHour(hours, hour) {
  if (hours.length === 0) return null;
  const h = ((Math.trunc(Number(hour)) % 24) + 24) % 24;
  let atOrBefore = null;
  let greatest = null;
  for (const k of hours) {
    if (greatest === null || k > greatest) greatest = k;
    if (k <= h && (atOrBefore === null || k > atOrBefore)) atOrBefore = k;
  }
  return atOrBefore !== null ? atOrBefore : greatest; // wrap to the latest posting when none ≤ now
}

// destinationFor — the area the NPC should be in at `hour`, by the cyclic active-hour rule. null when
// the NPC has no routine at all. Pure (reads the schedule, resolves the active posting).
export async function destinationFor(root, id, hour) {
  const schedule = await scheduleOf(root, id);
  const hours = Object.keys(schedule).map(Number);
  const key = activeHour(hours, hour);
  return key === null ? null : schedule[key];
}

// hourNow — the world's current hour (0..23). The explicit `hour` param wins (deterministic tests);
// otherwise read the dimension's `hour` cell, else derive it from the dimension's `tick` via clock.
async function hourNow(root, hour) {
  if (hour !== undefined && hour !== null) return ((Math.trunc(Number(hour)) % 24) + 24) % 24;
  const fromCell = await latest(root, DIMENSION, "hour", null);
  if (fromCell !== null) return ((Math.trunc(Number(fromCell)) % 24) + 24) % 24;
  const tick = Number(await latest(root, DIMENSION, "tick", 0));
  return clock(tick).hour;
}

// firstHopToward — one deterministic BFS step over `exit-*` from `start` toward `dest`: the dest of
// the first edge on a shortest path, or null if start IS dest / dest is unreachable. Sorted expansion
// (areas then directions) makes the chosen path replay-stable, exactly as decide.mjs's nearest() does.
async function firstHopToward(root, start, dest) {
  if (!start || !dest || start === dest) return null;
  const seen = new Set([start]);
  let frontier = [{ area: start, firstHop: null }];
  while (frontier.length > 0) {
    const ordered = [...frontier].sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : 0));
    const next = [];
    for (const node of ordered) {
      for (const { dest: to } of await exitsOf(root, node.area)) {
        if (seen.has(to)) continue;
        seen.add(to);
        const firstHop = node.firstHop ?? to; // the first step away from `start`
        if (to === dest) return firstHop; // reached the destination — return that opening hop
        next.push({ area: to, firstHop });
      }
    }
    frontier = next;
  }
  return null; // destination unreachable from start
}

// moversOf — every subject bearing a `mover` cell (an NPC/actor the tick walks), sorted for
// deterministic iteration. A bare read of the trace.
async function moversOf(root) {
  const out = [];
  for (const s of await subjects(root)) {
    if ((await latest(root, s, "mover")) !== null) out.push(s);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

// atDestination — is the NPC already standing in its active destination this hour? false when the NPC
// has no routine (no destination to be at). `hour?` defaults to the world's current hour.
export async function atDestination(root, id, hour) {
  const h = await hourNow(root, hour);
  const dest = await destinationFor(root, id, h);
  if (dest === null) return false;
  const loc = await locationOf(root, id);
  return loc === dest;
}

// tickRoutines — the effectful tick-rule (DEFAULT export). Read the hour; for each mover that has a
// routine and is NOT already at its active destination, walk it ONE hop toward that destination and
// file a `located-in` change attributed to the NPC. NPCs with no routine are untouched; NPCs already
// home stay put; NPCs whose destination is unreachable from where they stand do not move. Returns the
// appended rows (so the tick can fold/narrate) and a `moved` log. Deterministic: same world+t+hour →
// same appends.
export default async function tickRoutines(root, t, hour, amble = 1) {
  if (!root || t == null) throw new TypeError("tickRoutines: root and t are required");
  const h = await hourNow(root, hour);
  // AMBLE: NPCs need not step EVERY tick. With amble>1 each mover steps only on ticks where
  // (tick + hash(name)) % amble === 0 — so they amble toward their post, staggered by a name hash
  // rather than marching in lockstep. It thins the arrive/leave churn an onlooker sees (the world
  // feels unhurried) without any RNG: same world+t → same moves. amble=1 (the default, and the
  // test's call) steps every tick exactly as before.
  const tickNum = (() => { const m = /^tick:(\d+)/.exec(String(t)); return m ? Number(m[1]) : 0; })();
  const hash = (s) => { let h2 = 0x811c9dc5; const str = String(s); for (let i = 0; i < str.length; i += 1) { h2 ^= str.charCodeAt(i); h2 = Math.imul(h2, 0x01000193) >>> 0; } return h2 >>> 0; };
  const appended = [];
  const moved = [];
  for (const npc of await moversOf(root)) {
    const dest = await destinationFor(root, npc, h);
    if (dest === null) continue; // no routine — leave the NPC alone
    const loc = await locationOf(root, npc);
    if (loc === dest) continue; // already where it should be — nothing to do
    if (amble > 1 && (tickNum + hash(npc)) % amble !== 0) continue; // not this NPC's step this tick
    const hop = await firstHopToward(root, loc, dest);
    if (hop === null) continue; // unreachable (or no location) — cannot advance this tick
    const { row } = await changing({ root, agent: npc, subject: npc, predicate: "located-in", object: hop, t });
    appended.push(row);
    moved.push({ id: npc, toward: dest, hop });
  }
  return { appended, moved };
}

// CLI: node routine.mjs <world> <t> [hour]
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, t, hour] = process.argv.slice(2);
  if (!world || !t) {
    console.error("usage: node routine.mjs <world> <t> [hour]");
    process.exit(2);
  }
  const result = await tickRoutines(world, t, hour !== undefined ? Number(hour) : undefined);
  console.log(JSON.stringify(result));
}
