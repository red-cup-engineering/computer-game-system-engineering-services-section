// inspect — an admin/debug dump of one entity. Engine plumbing (a `scripts/` read), this is the
// "entity inspector" observability differentiator: it does not compute new state, it RENDERS the
// state the substrate already settles. Pure READ — settle the fiber, read the geometric history.
//
//   inspect(root, entity) -> { settled, history, witnesses }
//     - settled  : the entity's settled `being` WITH witnesses (settle's witness mode) — each cell
//       carries the content-addressed rows that justify each face (thick evidence), so an admin can
//       see WHY a cell holds, not just that it does.
//     - history  : the entity's entangled-pair history (voidmath F8 via historyOf) — the geometric
//       residue of its past (gap = depth of a normalization). The recorded causal trace, read off
//       the shape rather than stored beside it.
//     - witnesses: a flat per-cell index of the witness rowIds, for a quick admin scan.
//
// CLI: node scripts/inspect.mjs <world> <entity>

import { settle } from "#substrate";
import { historyOf } from "#history";

export default async function inspect(root, entity) {
  if (!root || !entity) throw new TypeError("inspect: root and entity are required");
  const [settled, history] = await Promise.all([
    settle(root, entity, { witness: true }),
    historyOf(root, entity),
  ]);
  // A flat witness index: predicate/object → the rows that justify each face. Pulled out of the
  // fiber so an admin sees the evidence at a glance; the fiber still carries it inline.
  const witnesses = settled.fiber.map((c) => ({
    predicate: c.predicate,
    object: c.object,
    glyph: c.value.glyph,
    witness: c.witness ?? { pos: [], neg: [] },
  }));
  return { settled, history, witnesses };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, entity] = process.argv.slice(2);
  if (!world || !entity) {
    console.error("usage: node inspect.mjs <world> <entity>");
    process.exit(2);
  }
  const out = await inspect(world, entity);
  console.log(`entity: ${out.settled.entity}`);
  console.log(`fiber (${out.settled.fiber.length} cell(s)):`);
  for (const c of out.settled.fiber) {
    const w = c.witness ?? { pos: [], neg: [] };
    console.log(`  [${c.value.glyph}] ${c.predicate} ${c.object}` +
      (c.observers.length ? `  ⟨${c.observers.join(",")}⟩` : "") +
      `  pos:${w.pos.length} neg:${w.neg.length}`);
  }
  if (out.history.entangled.length === 0) {
    console.log("history: no entangled pairs.");
  } else {
    console.log(`history (${out.history.entangled.length} entangled pair(s)):`);
    for (const p of out.history.entangled) {
      console.log(`  ${p.a.predicate} ${p.a.object}  ⋯gap ${p.gap}⋯  ${p.b.predicate} ${p.b.object}`);
    }
  }
}
