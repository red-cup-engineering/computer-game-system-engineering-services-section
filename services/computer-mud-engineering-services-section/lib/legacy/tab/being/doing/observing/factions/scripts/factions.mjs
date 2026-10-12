// factions — the COLLECTIVE reading of the social graph. `factions/` nests under `observing/` as
// a sibling of `needing` and `storylog`: it changes nothing, it is a QUOTE of how the population's
// pairwise opinions aggregate into groups. The commons-and-governance note names this the "nested,
// collective-choice, conflict-resolution layer" — a faction is not a new subsystem but a NAMING
// CONVENTION over the existing opinion/membership cells, read at the group level.
//
// The reading: take every npc (kind=npc), read its opinions toward every other npc — first the
// RECORDED stance (the `opinion-of:<other>=<stance>` cell convention from socialize), falling back
// to the COMPUTED opinion() over the two settled fibers when no stance is recorded. A FRIEND edge
// (stance 'friend') joins two npcs; a RIVAL edge marks tension. Factions are the CONNECTED
// COMPONENTS over the friend edges (union-find): people who friend each other, transitively, are
// one group. Rival edges that cross components are inter-faction tension; rival edges inside a
// component are intra-faction friction (counted, but they do not split the group).
//
// Pure reads over the social graph — settle + opinion only, no appends, no RNG, no Date. Fully
// DETERMINISTIC: members are sorted, components are ordered by their lexically-least member, and a
// faction's id is `faction:<least-member>` so the same world yields the same factions byte-for-byte.
//
// factions(root) -> [{ id, members:[npc], cohesion, tensions:[{a,b}] }]
//   cohesion : friend-edge density inside the group = friendEdges / C(n,2), in [0,1] (1 for a
//              singleton by convention — nothing to disagree with). Higher = tighter group.
//   tensions : the rival edges WITHIN this faction (intra-group friction), as sorted {a,b} pairs.
// factionOf(root, entity) -> the faction object that contains `entity`, or null if it is in none
//   (not an npc, or owns no log). Consistent with factions(root) — same partition.
// tensionBetween(root, a, b) -> { sameFaction, friendEdge, rivalEdge, factionA, factionB } — the
//   relationship between two entities read through the faction partition. rivalEdge across two
//   different factions is the INTER-faction tension the Director reads as `disputes`.
//
// CLI: node factions.mjs <world>            (lists factions, members, cohesion, tensions)
//      node factions.mjs <world> <a> <b>    (tensionBetween a and b)

import { subjects, settle, rowsFor } from "#substrate";
import opinion, { OPINION } from "#socializing";

// --- reading the npc population --------------------------------------------------------------

// npcsOf — every subject that is kind=npc, sorted. Deterministic node set for the graph.
async function npcsOf(root) {
  const out = [];
  for (const s of await subjects(root)) {
    const rows = await rowsFor(root, s);
    if (rows.some((r) => r.e === s && r.a === "kind" && r.v === "npc")) out.push(s);
  }
  return out.sort();
}

// stanceOf — A's stance toward B. Prefer the RECORDED opinion-of:<b> cell (latest-t wins, the
// socialize convention); fall back to the COMPUTED opinion() over the two settled fibers. Returns
// one of 'friend' | 'rival' | 'neutral' | 'ambivalent', or null if neither is available.
function recordedStance(aThing, bOther) {
  const pred = `${OPINION}${bOther}`;
  let best = null;
  for (const c of aThing.fiber) {
    if (c.predicate !== pred) continue;
    if (c.value.pos !== 1) continue; // only an asserted stance counts
    best = c.object; // settled fiber already superseded; a single cell survives
  }
  return best;
}

// edgesOf — the directed stance map over the npc population, plus the settled beings (cached so we
// settle each npc once). edges.get(a).get(b) = A's stance toward B.
async function graphOf(root) {
  const npcs = await npcsOf(root);
  const beings = new Map();
  for (const n of npcs) beings.set(n, await settle(root, n));

  const edges = new Map();
  for (const a of npcs) {
    const row = new Map();
    const aThing = beings.get(a);
    for (const b of npcs) {
      if (a === b) continue;
      let stance = recordedStance(aThing, b);
      if (stance == null) stance = opinion(aThing, beings.get(b)).stance;
      row.set(b, stance);
    }
    edges.set(a, row);
  }
  return { npcs, edges };
}

// A friend edge is SYMMETRIC for grouping: either direction friending makes them group-mates
// (the social graph is read as an undirected friendship graph for connected components). A rival
// edge in EITHER direction marks tension.
const isFriend = (edges, a, b) =>
  edges.get(a)?.get(b) === "friend" || edges.get(b)?.get(a) === "friend";
const isRival = (edges, a, b) =>
  edges.get(a)?.get(b) === "rival" || edges.get(b)?.get(a) === "rival";

// --- union-find over friend edges ------------------------------------------------------------

function components(npcs, edges) {
  const parent = new Map(npcs.map((n) => [n, n]));
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (x, y) => {
    const rx = find(x), ry = find(y);
    if (rx === ry) return;
    // attach the lexically-greater root under the lexically-lesser, so the component's
    // representative is always its least member — deterministic.
    if (rx < ry) parent.set(ry, rx);
    else parent.set(rx, ry);
  };
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      if (isFriend(edges, npcs[i], npcs[j])) union(npcs[i], npcs[j]);
    }
  }
  const groups = new Map(); // root -> [members]
  for (const n of npcs) {
    const r = find(n);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(n);
  }
  return groups;
}

// --- the public reads ------------------------------------------------------------------------

export default async function factions(root) {
  const { npcs, edges } = await graphOf(root);
  const groups = components(npcs, edges);

  const out = [];
  for (const [, membersRaw] of groups) {
    const members = [...membersRaw].sort();
    const n = members.length;

    // cohesion: friend-edge density inside the group. A singleton is cohesion 1 (nothing to
    // disagree with). For n>=2, friendEdges / C(n,2).
    let friendEdges = 0;
    const tensions = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (isFriend(edges, members[i], members[j])) friendEdges += 1;
        if (isRival(edges, members[i], members[j])) tensions.push({ a: members[i], b: members[j] });
      }
    }
    const pairs = (n * (n - 1)) / 2;
    const cohesion = n <= 1 ? 1 : friendEdges / pairs;

    out.push(Object.freeze({
      id: `faction:${members[0]}`,
      members,
      cohesion,
      tensions: Object.freeze(tensions),
    }));
  }
  // order factions by their id (== least member), deterministic.
  return out.sort((x, y) => x.id.localeCompare(y.id));
}

export async function factionOf(root, entity) {
  const fs = await factions(root);
  return fs.find((f) => f.members.includes(entity)) ?? null;
}

export async function tensionBetween(root, a, b) {
  const { edges } = await graphOf(root);
  const fa = await factionOf(root, a);
  const fb = await factionOf(root, b);
  const sameFaction = fa != null && fb != null && fa.id === fb.id;
  return Object.freeze({
    sameFaction,
    friendEdge: isFriend(edges, a, b),
    rivalEdge: isRival(edges, a, b),
    factionA: fa ? fa.id : null,
    factionB: fb ? fb.id : null,
  });
}

// interFactionTension — the count of rival edges that cross two DIFFERENT factions. This is the
// `disputes` contribution the Director reads: tension between groups, not within them. Exported so
// the Director can fold it without recomputing the graph by hand.
export async function interFactionTension(root) {
  const { npcs, edges } = await graphOf(root);
  const groups = components(npcs, edges);
  const rootOf = new Map();
  for (const [r, members] of groups) for (const m of members) rootOf.set(m, r);

  let count = 0;
  for (let i = 0; i < npcs.length; i++) {
    for (let j = i + 1; j < npcs.length; j++) {
      const a = npcs[i], b = npcs[j];
      if (rootOf.get(a) === rootOf.get(b)) continue; // same faction → not inter-faction
      if (isRival(edges, a, b)) count += 1;
    }
  }
  return count;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, a, b] = process.argv.slice(2);
  if (!world) {
    console.error("usage: node factions.mjs <world> [<a> <b>]");
    process.exit(2);
  }
  if (a && b) {
    console.log(JSON.stringify(await tensionBetween(world, a, b)));
  } else {
    const fs = await factions(world);
    for (const f of fs) {
      console.log(`${f.id}  members=[${f.members.join(", ")}]  cohesion=${f.cohesion.toFixed(2)}  tensions=${f.tensions.length}`);
    }
    console.log(`inter-faction tension: ${await interFactionTension(world)}`);
  }
}
