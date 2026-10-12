// direct — the STORYTELLER/Director: RimWorld-style closed-loop PACING that reads world-state and
// nudges the world's INITIAL CONDITIONS, never scripting an event and never touching a player's
// fiber. `directing/` nests under `observing/` because its core is a READ — `worldTension` — that
// folds the population of fibers into a small pressure vector, exactly the "Colony Wealth" gauge
// generalized (the-storyteller-and-director note). The only WRITE it does is `direct`'s single
// ambient append, and that append is an ORDINARY EAVT row the world's own physics could have
// emitted (deplete a resource a step further / surface a latent dispute) — Versu's "structure the
// situation", never Façade's "script the beat".
//
// THE STATE READ (the wealth gauge, inverted):
//   worldTension(root) -> { scarcity, lowMood, disputes, score }
//     scarcity : depleted-resource ratio — resources (kind=resource) whose `amount` is at/below
//                SCARCE_AT, over all resources. In [0,1]. (Low supply IS the pressure, inverted
//                from RimWorld's high-wealth pressure.)
//     lowMood  : fraction of npcs (kind=npc) whose mood band is 'strained' or 'breaking'. In [0,1].
//     disputes : count of ⊤ cells across every entity's settled fiber, PLUS inter-faction tension
//                (rival edges crossing factions). ⊤ is the contested fact; faction tension is the
//                apex on disputed cells — both are values already in the world, not invented.
//     score    : the scalar pacing signal, a weighted blend in [0,1]:
//                  W.scarcity*scarcity + W.lowMood*lowMood + W.disputes*clamp(disputes/DISPUTE_NORM).
//   PURE: settle / needsOf / factions reads only. Deterministic — no RNG, no Date.
//
// THE PACING POLICY (a target BAND over `score`, not a list of events):
//   policy = { target, band, ... } — the Director wants `score` inside [target-band, target+band].
//     - score BELOW the band  => the world has gone QUIET; seed ONE small tension (one append).
//     - score INSIDE the band => leave it; the pacing is where the policy wants it.
//     - score ABOVE the band  => the world is TENSE; do NOTHING — withhold and let it play out
//                                (Phoebe's downtime / Cassandra's falling action).
//   The menu of MINIMAL SEEDS (each a single ordinary append the world could emit), tried in order:
//     1. SPOIL  — drop the `amount` of the healthiest non-depleted resource by SPOIL_BY (toward 0).
//     2. DISPUTE — if no resource can be spoiled, surface a LATENT dispute: append a `contested`
//                  cell on the lexically-least npc (a row the world could file), nudging pressure.
//   Exactly ONE append per `direct` call when it intervenes; never on a player (kind=player) fiber.
//
// direct({ root, t, policy? }) -> { tension, intervention }
//   tension      : the worldTension(root) read taken BEFORE intervening.
//   intervention : null (nothing done), or { kind:'spoil'|'dispute', subject, predicate, object,
//                  row } describing the single ambient append that was made.
//
// CLI: node direct.mjs <world> [<t>]   (reads tension; with <t>, runs direct and reports)

import { subjects, settle, rowsFor } from "#substrate";
import { isTop } from "#value";
import doing from "#doing";
import { needsOf } from "#needing";
import { interFactionTension } from "../../factions/scripts/factions.mjs";

// SCARCE_AT — a resource at or below this `amount` counts as depleted (pressure). DISPUTE_NORM —
// the dispute count that saturates the disputes term to 1. SPOIL_BY — how much one spoil drops an
// amount. Tunable knobs, all deterministic.
export const SCARCE_AT = 1;
export const DISPUTE_NORM = 4;
export const SPOIL_BY = 2;

// W — the blend weights for the score. Scarcity and mood are the heavy pacing signals (RimWorld's
// wealth/threat and mood are the load-bearing gauges); disputes add a normalized contribution.
export const W = Object.freeze({ scarcity: 0.4, lowMood: 0.4, disputes: 0.2 });

// DEFAULT_POLICY — Cassandra-ish: keep score around a moderate target. Below the band the world is
// too quiet and earns ONE seed; above it, the Director withholds.
export const DEFAULT_POLICY = Object.freeze({ target: 0.35, band: 0.1, spoilBy: SPOIL_BY });

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// kindOf — the latest-wins `kind` of a subject off its raw rows (cheap; avoids a full settle just
// to classify). Functional, so the max-t kind row wins.
function kindOf(rows, subject) {
  let best = null, bestT = null;
  for (const r of rows) {
    if (r.e !== subject || r.a !== "kind") continue;
    if (bestT === null || r.t > bestT) { bestT = r.t; best = r.v; }
  }
  return best;
}

// amountOf — the latest-wins `amount` of a resource off its settled fiber (functional cell).
function amountOf(thing) {
  for (const c of thing.fiber) {
    if (c.predicate !== "amount") continue;
    if (c.value.pos !== 1) continue;
    const n = Number(c.object);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

// census — one disk pass classifying the population into resources / npcs (with settled beings and
// amounts cached), so worldTension and direct share a single read.
async function census(root) {
  const resources = []; // { subject, thing, amount }
  const npcs = [];       // subject
  let topCells = 0;      // ⊤ cells across all settled fibers
  for (const s of await subjects(root)) {
    const rows = await rowsFor(root, s);
    if (rows.length === 0) continue;
    const kind = kindOf(rows, s);
    const thing = await settle(root, s);
    for (const c of thing.fiber) if (isTop(c.value)) topCells += 1;
    if (kind === "resource") resources.push({ subject: s, thing, amount: amountOf(thing) });
    else if (kind === "npc") npcs.push(s);
  }
  resources.sort((a, b) => a.subject.localeCompare(b.subject));
  npcs.sort();
  return { resources, npcs, topCells };
}

export async function worldTension(root) {
  const { resources, npcs, topCells } = await census(root);

  // scarcity: depleted-resource ratio. With no resources, no scarcity pressure.
  const depleted = resources.filter((r) => r.amount != null && r.amount <= SCARCE_AT).length;
  const scarcity = resources.length === 0 ? 0 : depleted / resources.length;

  // lowMood: fraction of npcs whose mood band is strained/breaking.
  let strained = 0;
  for (const n of npcs) {
    const { band } = await needsOf(root, n);
    if (band === "strained" || band === "breaking") strained += 1;
  }
  const lowMood = npcs.length === 0 ? 0 : strained / npcs.length;

  // disputes: ⊤ cells across entities + inter-faction tension (rival edges crossing factions).
  const disputes = topCells + (await interFactionTension(root));

  const score = clamp01(
    W.scarcity * scarcity +
    W.lowMood * lowMood +
    W.disputes * clamp01(disputes / DISPUTE_NORM),
  );

  return Object.freeze({ scarcity, lowMood, disputes, score });
}

export async function direct({ root, t, policy } = {}) {
  if (!root || t == null) throw new TypeError("direct: root and t are required");
  const pol = { ...DEFAULT_POLICY, ...(policy ?? {}) };
  const tension = await worldTension(root);

  const lo = pol.target - pol.band;
  // INSIDE or ABOVE the band → withhold: seed nothing, let the world play out.
  if (tension.score >= lo) return { tension, intervention: null };

  // BELOW the band → the world is quiet; seed ONE minimal tension. Re-census to pick a target.
  const { resources } = await census(root);

  // SEED 1 — SPOIL: drop the healthiest non-depleted resource's amount toward 0. "Healthiest" =
  // highest amount, tie-broken lexically — deterministic. This is a row the world could file.
  const spoilable = resources
    .filter((r) => r.amount != null && r.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.subject.localeCompare(b.subject));
  if (spoilable.length > 0) {
    const r = spoilable[0];
    const next = Math.max(0, r.amount - (pol.spoilBy ?? SPOIL_BY));
    const { row } = await doing({ root, agent: "director", subject: r.subject, predicate: "amount", object: next, t });
    return { tension, intervention: { kind: "spoil", subject: r.subject, predicate: "amount", object: next, row } };
  }

  // SEED 2 — DISPUTE: no resource to spoil; surface a latent dispute on the lexically-least npc
  // (never a player). A `contested` cell is an ordinary row; it raises the disputes signal.
  const { npcs } = await census(root);
  if (npcs.length > 0) {
    const subject = npcs[0]; // npcs are kind=npc by construction, so never a player
    const { row } = await doing({ root, agent: "director", subject, predicate: "contested", object: "resource-claim", t });
    return { tension, intervention: { kind: "dispute", subject, predicate: "contested", object: "resource-claim", row } };
  }

  // nothing to seed (empty world) — withhold.
  return { tension, intervention: null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, t] = process.argv.slice(2);
  if (!world) {
    console.error("usage: node direct.mjs <world> [<t>]");
    process.exit(2);
  }
  if (t) {
    const { tension, intervention } = await direct({ root: world, t });
    console.log(JSON.stringify({ tension, intervention }));
  } else {
    console.log(JSON.stringify(await worldTension(world)));
  }
}
