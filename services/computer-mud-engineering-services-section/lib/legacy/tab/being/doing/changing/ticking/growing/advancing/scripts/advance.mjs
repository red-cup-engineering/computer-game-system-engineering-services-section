// advance — the tower-fold for an ACTOR. Advancement is crossing a SETTLEMENT THRESHOLD, NOT a
// level number: an actor unlocks an OFFICE exactly when the required skill sub-fiber CLOSES.
// `advancing/` nests under `growing/` because this is the same step `fold` (grow.mjs) runs for
// a room — restrict the fiber, ask `closure(subFiber).distance === 0`, and if so mint a
// vocabulary atom with the SAME `settled-as` / `is-atom-at-level` rows the fold uses. No level
// numbers anywhere; the "level" is just the office name and the closed sub-fiber that earned it.
//
// advance({ root, actor, office, requires, t }) -> { advanced, reason, atom? }
//   requires : [skill, ...] — the skill names whose `skill:<name>` cells must all CLOSE
//   t        : optional deterministic stamp PREFIX (default "advance"); rows `<prefix>:NNNNNN`
//   advanced:true  ⇒ appended a FUNCTIONAL `office` row (actor holds the office) + a `settled-as`
//                    /`is-atom-at-level` atom; `atom` is the minted vocabulary atom.
//   advanced:false ⇒ a required skill cell is still ⊥ (open) or ⊤ (contested); `reason` says which.

import doing from "#doing";
import { settle } from "#substrate";
// The two sibling progression morphisms. Imported by RELATIVE path so advance is self-contained
// before the package wires `#closure` / `#practicing` aliases (the test imports it the same way).
import closure from "../../../../../../library/value/library/closure/scripts/closure.mjs";
import { skillPredicate } from "../../../../../practicing/scripts/practice.mjs";

// subFiber — restrict a settled being's fiber to the `requires` skill channels. A required skill
// with NO cell at all is represented as a synthetic ⊥ cell, so a never-practised requirement
// reads as OPEN (distance > 0) rather than silently vanishing from the closure count.
function subFiber(thing, requires) {
  const want = new Set(requires.map(skillPredicate));
  const present = thing.fiber.filter((c) => want.has(c.predicate));
  const have = new Set(present.map((c) => c.predicate));
  const missing = [...want]
    .filter((p) => !have.has(p))
    .map((p) => ({ predicate: p, object: null, value: { pos: 0, neg: 0, glyph: "⊥" } }));
  return { entity: thing.entity, fiber: [...present, ...missing] };
}

export default async function advance({ root, actor, office, requires, t }) {
  if (!root || actor == null || office == null || !Array.isArray(requires) || requires.length === 0) {
    throw new TypeError("advance: root, actor, office, and a non-empty requires[] are required");
  }

  // Settle the actor (skill cells ACCRUE — contradictory practice settles to ⊤, never silently
  // latest-wins), then restrict to the required skill channels and measure closure distance.
  const thing = await settle(root, actor);
  const sub = subFiber(thing, requires);
  const c = closure(sub);

  if (c.distance !== 0) {
    // Still off the fixed point. Name which channels keep it open / contested.
    const open = sub.fiber.filter((cell) => cell.value.pos === 0 && cell.value.neg === 0).map((cell) => cell.predicate);
    const contested = sub.fiber.filter((cell) => cell.value.pos === 1 && cell.value.neg === 1).map((cell) => cell.predicate);
    const parts = [];
    if (open.length) parts.push(`open: ${open.join(", ")}`);
    if (contested.length) parts.push(`contested: ${contested.join(", ")}`);
    return { advanced: false, reason: `required skills not closed (${parts.join("; ")})` };
  }

  // The sub-fiber is CLOSED — cross the threshold. Deterministic counter t.
  const prefix = t ?? "advance";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;

  // File the FUNCTIONAL `office` row (the actor now holds the office) and mint the vocabulary
  // atom with the fold's own rows, so an advanced actor IS an atom at the next level.
  const atom = `atom-office-${office}`;
  await doing({ root, subject: actor, predicate: "office", object: office, t: stamp() });
  await doing({ root, subject: actor, predicate: "settled-as", object: atom, t: stamp() });
  await doing({ root, subject: atom, predicate: "is-atom-at-level", object: office, t: stamp() });

  return { advanced: true, reason: `required skills closed: ${requires.join(", ")}`, atom };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, actor, office, ...requires] = process.argv.slice(2);
  if (!world || !actor || !office || requires.length === 0) {
    console.error("usage: node advance.mjs <world> <actor> <office> <skill...>");
    process.exit(2);
  }
  const r = await advance({ root: world, actor, office, requires });
  console.log(JSON.stringify(r));
}
