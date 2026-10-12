// deciding — the utility-AI decision: the one MOVE an npc would make this tick to pursue its
// most pressing need. `deciding/` nests under `responding/` because a decision IS a respond —
// the npc reading its situation and choosing the message that best closes its pressing need.
//
// Needs-based GOAP, the Tynan-Sylvester loop: the npc pursues its MOST PRESSING need through a
// scarce world, and that pursuit (plus scarcity and mood) is what makes the story. decide():
//   1. settle the actor, read `needs` (levels + mood + the pressing need).
//   2. if no need presses → idle (the npc is content; the tick may wander it elsewhere).
//   3. find the resource that `provides` the pressing need, NEAREST by a deterministic BFS over
//      `exit-*` from the actor's area.
//      - co-located (resource is in the actor's area) → a `use`: raise need:<pressing> toward the
//        ceiling AND deplete the resource's `amount` (two moves), so satisfaction is SCARCE.
//      - elsewhere → a `move`: relocate the actor `located-in` the next area toward the resource
//        (the first hop on the BFS path).
//      - unreachable / depleted → idle.
//
// PURE: decide RETURNS the move(s); it never writes. The tick enacts the returned rows. No RNG,
// no Date; every choice tie-breaks by a deterministic sort, so a world replays to one decision.
//
// decide({ root, actor }) -> { kind:'use'|'move'|'idle', moves:[{subject,predicate,object}], why } | null

import { rowsFor, subjects, locationOf } from "#substrate";
import needs, { NEED_FUNCTIONAL } from "../../../observing/needing/scripts/needs.mjs";
import { settle } from "#substrate";

// The level a `use` raises a need to (the comfortable ceiling — one good meal/rest/play).
const USE_RAISES_TO = 90;

// latest — the latest functional value of a predication on an entity (max-t base row, v≠null).
async function latest(root, entity, predicate, fallback = null) {
  const rows = (await rowsFor(root, entity)).filter(
    (r) => r.e === entity && r.a === predicate && r.v !== null,
  );
  let best = null;
  for (const r of rows) if (best === null || r.t > best.t) best = r;
  return best ? best.v : fallback;
}

// exitsOf — the area's walkable neighbours: {dir → destination area} from its `exit-*` cells,
// latest-wins per direction. Sorted by direction so BFS expansion is deterministic.
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

// resourcesFor — every resource in the world that `provides` the given need and still has
// amount > 0, as {id, area}. Deterministic (subjects() is sorted). A bare read of the trace.
async function resourcesFor(root, need) {
  const want = `need:${need}`;
  const out = [];
  for (const s of await subjects(root)) {
    if ((await latest(root, s, "kind")) !== "resource") continue;
    if ((await latest(root, s, "provides")) !== want) continue;
    const amount = Math.trunc(Number(await latest(root, s, "amount", 0)));
    if (!(amount > 0)) continue;
    const area = await latest(root, s, "located-in");
    if (!area) continue;
    out.push({ id: s, area, amount });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

// nearest — BFS over exit-* from `start`, returning the nearest resource and the FIRST hop on the
// path to it: { resource, firstHop, distance } or null. Deterministic: areas are expanded in
// sorted-direction order; ties in distance break by sorted resource id (resourcesFor is sorted,
// and BFS reaches equal-distance areas in a stable order). `firstHop` is null when co-located.
async function nearest(root, start, resources) {
  if (resources.length === 0) return null;
  const here = resources.filter((r) => r.area === start);
  if (here.length > 0) return { resource: here[0], firstHop: null, distance: 0 };

  const byArea = new Map();
  for (const r of resources) if (!byArea.has(r.area)) byArea.set(r.area, r); // sorted-id first

  // BFS; firstHopTo[area] = the destination of the first step on the shortest path to `area`.
  const seen = new Set([start]);
  let frontier = [{ area: start, firstHop: null }];
  let distance = 0;
  while (frontier.length > 0) {
    distance += 1;
    const next = [];
    // Expand the frontier in a deterministic order (sorted by area, then by exit direction).
    const ordered = [...frontier].sort((a, b) => (a.area < b.area ? -1 : a.area > b.area ? 1 : 0));
    const arrivals = []; // areas reached at THIS distance, with their firstHop
    for (const node of ordered) {
      for (const { dest } of await exitsOf(root, node.area)) {
        if (seen.has(dest)) continue;
        seen.add(dest);
        const firstHop = node.firstHop ?? dest; // the first step away from `start`
        arrivals.push({ area: dest, firstHop });
        next.push({ area: dest, firstHop });
      }
    }
    // A resource reachable at this distance? Pick the nearest by sorted resource id.
    const hits = arrivals
      .filter((a) => byArea.has(a.area))
      .map((a) => ({ resource: byArea.get(a.area), firstHop: a.firstHop }))
      .sort((x, y) => (x.resource.id < y.resource.id ? -1 : x.resource.id > y.resource.id ? 1 : 0));
    if (hits.length > 0) return { resource: hits[0].resource, firstHop: hits[0].firstHop, distance };
    frontier = next;
  }
  return null; // no providing resource reachable
}

export default async function decide({ root, actor }) {
  if (!root || !actor) throw new TypeError("decide: root and actor are required");

  const thing = await settle(root, actor, { functional: NEED_FUNCTIONAL });
  const reading = needs(thing);
  const pressing = reading.pressing;

  // No need presses: nothing to pursue. Idle — the tick may wander/socialize the npc itself.
  if (!pressing) {
    return { kind: "idle", moves: [], why: `no pressing need (band ${reading.band})` };
  }

  const loc = await locationOf(root, actor);
  if (!loc) return { kind: "idle", moves: [], why: "actor has no location" };

  const resources = await resourcesFor(root, pressing);
  const target = await nearest(root, loc, resources);
  if (!target) {
    return { kind: "idle", moves: [], why: `need:${pressing} pressing but no resource reachable` };
  }

  // Co-located → USE: raise the need toward the ceiling AND deplete the resource (scarcity).
  if (target.firstHop === null) {
    const cur = reading.levels[pressing];
    const raised = cur >= USE_RAISES_TO ? cur : USE_RAISES_TO;
    return {
      kind: "use",
      moves: [
        { subject: actor, predicate: `need:${pressing}`, object: raised },
        { subject: target.resource.id, predicate: "amount", object: Math.max(0, target.resource.amount - 1) },
      ],
      why: `use ${target.resource.id} here to satisfy need:${pressing} (${cur}→${raised})`,
    };
  }

  // Elsewhere → MOVE one hop toward the nearest providing resource.
  return {
    kind: "move",
    moves: [{ subject: actor, predicate: "located-in", object: target.firstHop }],
    why: `move toward ${target.resource.id} for need:${pressing} (next hop ${target.firstHop}, ${target.distance} away)`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, actor] = process.argv.slice(2);
  if (!world || !actor) {
    console.error("usage: node decide.mjs <world> <actor>");
    process.exit(2);
  }
  console.log(JSON.stringify(await decide({ root: world, actor })));
}
