// history — an entity's history is GEOMETRIC (finite-voidmath F8), not a quest log kept beside
// it. `history/` nests inside `being/` because history is a pure READ of the settled fiber:
// being folds the trace into a deterministically-ordered fiber, and history reads the residue
// of normalization out of that order. No new store, no new value math.
//
// An ENTANGLED PAIR (Thing F8.1) is two cells of a settled fiber whose predicates are
// BYPASS-RELATED (Act 3.1, asymmetric) AND that are NON-ADJACENT in the settled order. The
// bypass relation is declared as DATA, exactly like converse: a row {e:P, a:"bypasses", v:Q}
// posits Act 3.1(P,Q) — P bypasses Q. The GAP (index distance in the sorted fiber) is the
// residue (Quality F8.2): "their positions encode the history of normalization" — a wider gap
// is a deeper past.
//
// history(thing, bypass) -> { entity, entangled: [{ a:{predicate,object}, b:{predicate,object}, gap }] }

import { settle, rowsFor } from "#substrate";

// bypassRelation — collect (P bypasses Q) declarations into P -> {Q...}. Mirrors how being
// collects has-converse: a conformant row {e:P, a:"bypasses", v:Q} reads as bypass[P] ∋ Q. The
// relation is asymmetric (Act 3.1): only the declared orientation holds.
export function bypassRelation(rows) {
  const bypass = new Map();
  for (const r of rows) {
    if (r.a !== "bypasses") continue;
    if (!bypass.has(r.e)) bypass.set(r.e, new Set());
    bypass.get(r.e).add(r.v);
  }
  return bypass;
}

// history — pure read over a settled being and a bypass relation. For each ordered cell pair
// (ci, cj) with i < j in the (already deterministically sorted) fiber, emit an entangled pair
// when ci.predicate bypasses cj.predicate (Act 3.1) AND the cells are non-adjacent (j - i >= 2,
// Thing F8.1). gap = j - i is the normalization residue (Quality F8.2).
export default function history(thing, bypass) {
  const fiber = thing.fiber;
  const entangled = [];
  for (let i = 0; i < fiber.length; i++) {
    const ci = fiber[i];
    const reach = bypass.get(ci.predicate);
    if (!reach) continue;
    for (let j = i + 1; j < fiber.length; j++) {
      const cj = fiber[j];
      if (!reach.has(cj.predicate)) continue;
      if (j - i < 2) continue; // adjacent cells are not entangled
      entangled.push({
        a: { predicate: ci.predicate, object: ci.object },
        b: { predicate: cj.predicate, object: cj.object },
        gap: j - i,
      });
    }
  }
  return { entity: thing.entity, entangled };
}

// historyOf — the substrate read: settle the subject and read its bypass declarations off the
// same trace, then fold to its geometric history. Mirrors settle.
export async function historyOf(root, subject, opts) {
  const [thing, rows] = await Promise.all([settle(root, subject, opts), rowsFor(root, subject)]);
  return history(thing, bypassRelation(rows));
}

// CLI: node history.mjs <world> <subject> — render the entity's entangled pairs (the geometric
// record), not generate them.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node history.mjs <world-dir> <subject>");
    process.exit(1);
  }
  const h = await historyOf(world, subject);
  if (h.entangled.length === 0) {
    console.log(`${h.entity} has no entangled pairs (a settled past with nothing composed).`);
  } else {
    console.log(`${h.entity} — geometric history (${h.entangled.length} entangled pair(s)):`);
    for (const p of h.entangled) {
      console.log(`  ${p.a.predicate} ${p.a.object}  ⋯gap ${p.gap}⋯  ${p.b.predicate} ${p.b.object}`);
    }
  }
}
