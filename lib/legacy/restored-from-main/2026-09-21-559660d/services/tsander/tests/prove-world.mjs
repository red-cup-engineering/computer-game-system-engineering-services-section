// prove-world — the federated trace WORLD substrate (see src/world.mjs header for the federation
// port that closed this file's scope cut): admitting rows is append-only and deduplicated, unvisited subjects
// read as ⊥, a converse pair folds to ⊤ HELD with both witnesses never dropped, positionOf reads
// the functional (latest-t) cell, and renderables/disagreements walk the whole world honestly. New
// tests written for this port against the REAL @561-group/computer substrate (installed from
// Verdaccio, not mocked) — no legacy test existed for tsander (see the package README's Port notes).

import {
  emptyWorld, admitRows, admitLog, worldFromRows, allRows, admittedRows, subjects,
  place, positionOf, renderables, disagreements, chargeOf, FOUR, predicate, deny,
  federate, mergeWorlds, migrate, frontier, inertFor, contentKey,
} from "../src/world.mjs";
import { ok, eq, done } from "./_harness.mjs";

// ── admitRows: append-only, deduplicated ──────────────────────────────────────────────────
{
  // A world is a federated Map<subject, log>, so rows are read through allRows rather than a `.rows`
  // array. The append-only union laws are unchanged by the federation port.
  const w0 = emptyWorld();
  eq(allRows(w0), [], "emptyWorld starts with no rows");
  const r1 = predicate("vega-prime", "hull", "star", 1);
  const w1 = admitRows(w0, [r1]);
  eq(allRows(w1).length, 1, "admitRows appends a row");
  eq(allRows(w0).length, 0, "admitRows does not mutate the original world (immutable trace)");
  const w2 = admitRows(w1, [r1]); // the identical row again
  eq(allRows(w2).length, 1, "admitRows deduplicates an identical row by content id");
  const r2 = predicate("vega-prime", "hull", "star", 2); // same fields but different t => different id
  const w3 = admitRows(w2, [r2]);
  eq(allRows(w3).length, 2, "admitRows admits a row that differs by even one field (t) as a NEW row");
}

// ── admitLog: the single-writer shape compatible with engine.mjs call sites ──────────────
{
  const w0 = emptyWorld();
  const { world: w1 } = admitLog(w0, "vega-prime", [predicate("vega-prime", "hull", "star", 1)]);
  eq(allRows(w1).length, 1, "admitLog returns { world } with the row admitted");
}

// ── worldFromRows / allRows / subjects ────────────────────────────────────────────────────
{
  const rows = [
    predicate("sol-iii", "at-position", [0, 0, 0], 1),
    predicate("belt-7", "at-position", [-4, -1, -3], 1),
    predicate("belt-7", "hazard", "pirates", 1),
  ];
  const w = worldFromRows(rows);
  eq(allRows(w).length, 3, "worldFromRows admits every seed row");
  eq(subjects(w), ["belt-7", "sol-iii"], "subjects lists every distinct entity, sorted");
}

// ── unvisited = ⊥ ──────────────────────────────────────────────────────────────────────────
{
  const w = worldFromRows([predicate("sol-iii", "at-position", [0, 0, 0], 1)]);
  const p = place(w, "ghost-station");
  ok(p.visited === false, "a subject with no rows at all is UNVISITED");
  ok(p.charge === FOUR.BOT, "an unvisited subject's charge is ⊥ (bot)");
  eq(p.contested, [], "an unvisited subject has no contested cells");
  eq(chargeOf({}), FOUR.BOT, "chargeOf({}) (no pos, no neg) is ⊥");
}

// ── a plain affirmed cell reads t ─────────────────────────────────────────────────────────
{
  const w = worldFromRows([predicate("port-zarya", "controlled-by", "federation", 1)]);
  const p = place(w, "port-zarya");
  ok(p.visited === true, "a subject with evidence is visited");
  ok(p.charge === FOUR.T, "a subject with only affirming evidence charges t");
  eq(p.section.affirmed, [{ predicate: "controlled-by", object: "federation" }], "the section's affirmed bucket names the cell");
  eq(p.section.contradicted, [], "no contradiction => the contradicted bucket is empty");
}

// ── THE LAW: a claim AND its converse fold to ⊤, HELD, both witnesses kept ───────────────
{
  const w = worldFromRows([
    predicate("vega-prime", "controlled-by", "federation", 2),
    deny("vega-prime", "controlled-by", "federation", 3), // the converse: not-controlled-by
  ]);
  const p = place(w, "vega-prime");
  ok(p.charge === FOUR.TOP, "a claim + its converse charges ⊤ (top), never silently resolved");
  eq(p.contested.length, 1, "exactly one contested cell");
  eq(p.contested[0].predicate, "controlled-by", "the contested cell names the POSITIVE predicate (oriented by convention)");
  eq(p.contested[0].object, "federation", "the contested cell names the disputed object");
  ok(Array.isArray(p.contested[0].evidence[0]) && p.contested[0].evidence[0].length === 1, "the affirming witness is kept");
  ok(Array.isArray(p.contested[0].evidence[1]) && p.contested[0].evidence[1].length === 1, "the denying witness is kept — NEITHER witness is dropped");
  eq(p.section.contradicted, [{ predicate: "controlled-by", object: "federation" }], "the section's contradicted bucket names the ⊤ cell");
}

// ── positionOf reads the functional (latest-t) at-position cell ──────────────────────────
{
  const w = worldFromRows([
    predicate("scout-1", "at-position", [0, 0, 0], 1),
    predicate("scout-1", "at-position", [5, 5, 5], 9), // a later position — functional, latest wins
  ]);
  eq(positionOf(w, "scout-1"), [5, 5, 5], "positionOf reads the LATEST at-position (functional supersede)");
  eq(positionOf(w, "nowhere"), null, "positionOf returns null for a subject with no position evidence");
}

// ── renderables: only subjects with a position are drawable ──────────────────────────────
{
  const w = worldFromRows([
    predicate("sol-iii", "at-position", [0, 0, 0], 1),
    predicate("sol-iii", "hull", "star", 1),
    predicate("lore-only", "material", "legend", 1), // no at-position => not drawable
  ]);
  const rs = renderables(w);
  eq(rs.length, 1, "renderables includes only the positioned subject");
  eq(rs[0].subject, "sol-iii", "the renderable names its subject");
  eq(rs[0].position, [0, 0, 0], "the renderable carries its position");
  eq(rs[0].shape, "star", "the renderable's shape reads the subject's hull row");
  ok(rs[0].charge === FOUR.T, "the renderable's charge matches its place's charge");
}

// ── disagreements: every ⊤ cell across the world, with its subject named ─────────────────
{
  const w = worldFromRows([
    predicate("port-zarya", "controlled-by", "federation", 1), // settled, no dispute
    predicate("vega-prime", "controlled-by", "federation", 2),
    deny("vega-prime", "controlled-by", "federation", 3),
  ]);
  const ds = disagreements(w);
  eq(ds.length, 1, "disagreements lists exactly the one contested cell across the whole world");
  eq(ds[0].subject, "vega-prime", "a disagreement names its subject");
  eq(ds[0].predicate, "controlled-by", "a disagreement names its predicate");
}

// ── FEDERATION: what the port scope cut deferred, now live ────────────────────────────────
// Two peers each hold their own world. Federating them is a content-id union of every log: no
// coordinator, no clock, no last-write-wins.
{
  const t = { n: 1, by: "peer-a" };
  const u = { n: 1, by: "peer-b" };
  const a = worldFromRows([{ e: "vega-prime", a: "controlled-by", v: "unity", t }]);
  const b = worldFromRows([{ e: "vega-prime", a: "not-controlled-by", v: "unity", t: u }]);

  const both = federate(a, b);
  eq(allRows(both).length, 2, "federating two disagreeing peers keeps BOTH rows — no witness dropped");
  const p = place(both, "vega-prime");
  eq(p.charge, FOUR.TOP, "the contested cell settles to ⊤ — held, never resolved to a winner");
  eq(p.contested.length, 1, "and it is reported as exactly one contested cell");

  // The laws that make coordination unnecessary.
  ok(contentKey(federate(both, both)) === contentKey(both), "federate is idempotent");
  ok(contentKey(federate(a, b)) === contentKey(federate(b, a)), "federate is commutative — peer order is irrelevant");
  ok(contentKey(mergeWorlds(a, b)) === contentKey(both), "mergeWorlds agrees with the binary tensor");

  // Agreement is not double-counted.
  const c = worldFromRows([{ e: "sol-iii", a: "at-position", v: [0, 0, 0], t: 1 }]);
  eq(allRows(federate(c, c)).length, 1, "an identical row from two peers is ONE row (a G-Set union)");
}

// ── the L10a admission gate: a hostile peer cannot force ⊤ everywhere ─────────────────────
{
  const honest = worldFromRows([{ e: "vega-prime", a: "controlled-by", v: "unity", t: { n: 1, by: "peer-a" } }]);
  const hostile = worldFromRows([{ e: "vega-prime", a: "not-controlled-by", v: "unity", t: { n: 1, by: "sybil" } }]);

  eq(place(federate(honest, hostile), "vega-prime").charge, FOUR.TOP,
     "ungated, an unrecognized peer's converse-spam DOES force the cell to ⊤ — this is the attack");

  const gated = federate(honest, hostile, { recognize: new Set(["peer-a"]) });
  eq(place(gated, "vega-prime").charge, FOUR.T, "gated, the honest claim stands and the injection is refused");
  eq(inertFor(gated, "vega-prime").length, 1, "the unrecognized row is quarantined, not folded as fact");
  eq(allRows(gated).length, 2, "and it is still PRESENT — quarantined is held inert, never deleted");
  eq(admittedRows(gated).length, 1, "admittedRows is the folded set, so the quarantine cannot reach the read");

  // Over-gating honest contest is the failure mode the contract forbids.
  const bothRecognized = federate(honest, hostile, { recognize: new Set(["peer-a", "sybil"]) });
  eq(place(bothRecognized, "vega-prime").charge, FOUR.TOP,
     "two RECOGNIZED peers disagreeing still reach ⊤ — honest contest survives the gate");
}

// ── frontier and migrate: the per-observer read and moving an entity between worlds ───────
{
  const a = worldFromRows([{ e: "belt-7", a: "hull", v: "rock", t: 1 }]);
  const folded = frontier(a, "belt-7", {});
  ok(folded.fiber.length > 0, "frontier folds a subject's own admitted log");
  const moved = migrate(a, emptyWorld(), "belt-7");
  ok(subjects(moved).includes("belt-7") || allRows(moved).length > 0, "migrate carries an entity into another world");
}

done("prove-world");
