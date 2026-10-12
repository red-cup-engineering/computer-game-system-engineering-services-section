// richness — value as fiber richness, read off a settled being. value is NOT a number a thing
// carries; it is a property of how richly the thing's fiber composes. A thing is worth more when
// its fiber has more DETERMINED cells (⊥ — honest ignorance — contributes nothing; ⊤ — a thing
// the world argues about — COUNTS, a contested thing isn't worthless). Functional/settled cells
// (the substrate's FUNCTIONAL set) weigh more, because scarcity IS settledness: a single-valued,
// superseding cell is the dense/inert/stable kind, where abundance is the firable many-valued kind.
//
// Pure: reads only the fiber + `#value` (isDetermined / isTop) + `#substrate`'s FUNCTIONAL set.
// Nothing changes; this is a quote, not a move. Sketched in docs/dev/notes/economy-is-predicate-
// richness.md (the addendum), the smallest additive economic signal tab was missing.
//
// richness(thing, opts?) -> { score, determined, contested }
//   thing : a settled being { entity, fiber:[{ predicate, object, value:{pos,neg,glyph}, ... }] }
//   opts.functionalWeight : weight of a functional-predicate determined cell (default 2).
// richnessOf(root, subject, opts?) = richness(await settle(root, subject), opts).

import { isDetermined, isTop } from "#value";
import { settle, FUNCTIONAL } from "#substrate";

export default function richness(thing, opts = {}) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("richness: thing must be a settled being { entity, fiber }");
  }
  const functionalWeight = opts.functionalWeight ?? 2;

  let score = 0;
  let determined = 0;
  let contested = 0;
  for (const cell of thing.fiber) {
    const v = cell.value;
    if (!isDetermined(v)) continue; // ⊥ contributes nothing
    determined += 1;
    if (isTop(v)) contested += 1; // ⊤ counts toward worth and is contested
    // scarcity = settledness: a functional (single-valued, superseding) cell weighs more.
    score += FUNCTIONAL.has(cell.predicate) ? functionalWeight : 1;
  }

  return { score, determined, contested };
}

export async function richnessOf(root, subject, opts = {}) {
  return richness(await settle(root, subject, opts.settle ?? {}), opts);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node richness.mjs <world> <subject>");
    process.exit(2);
  }
  const r = await richnessOf(world, subject);
  console.log(JSON.stringify(r));
}
