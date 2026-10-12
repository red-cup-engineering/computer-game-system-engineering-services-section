// monologue — the INNER MONOLOGUE: an actor's contradictions read aloud. `monologuing/` nests
// inside `observing/` because to monologue is to OBSERVE one's own being — a sensing cut turned
// inward. It READS being's residue (a settled fiber) and emits, but invents nothing: every line
// is a ⊤ cell, formatted from its predicate+object.
//
// The Disco-Elysium re-reading: a ⊤ cell is a belief held BOTH WAYS — "told both true and false"
// — a contradiction the world holds as a VALUE (#value isTop). Each such cell is one line of
// inner monologue ("you are a hero" and yet "you are a wreck", both, at once). The COUNT of ⊤
// cells is how torn the character is — the depth of play. A determined cell (t/f/⊥) is settled;
// it gets no line, because there is nothing to argue with. This is a FORMATTER: it does not
// generate prose, it renders the predicate+object of each contradiction the fiber already holds.
//
// monologue(thing) -> string[]            (one line per ⊤ cell, deterministically sorted)
// monologueOf(root, subject, opts?) -> string[]   (settle the subject, then monologue)
// CLI: node monologue.mjs <world> <subject>

import { isTop } from "#value";
import { settle } from "#substrate";

// line — format one contested cell as inner monologue. The cell's predicate+object IS the
// content; "held both ways" names the ⊤ (the converse and the predicate both asserted).
const line = (cell) => `${cell.predicate} ${cell.object} — held both ways`;

export default function monologue(thing) {
  if (!thing || !Array.isArray(thing.fiber)) {
    throw new TypeError("monologue: argument must be a settled being { entity, fiber }");
  }
  return thing.fiber
    // a ⊤ cell carries both faces (pos & neg). value.glyph is "⊤"; isTop reads the pair.
    .filter((c) => c.value && (isTop(c.value) || c.value.glyph === "⊤"))
    .map((c) => ({ key: `${c.predicate} ${String(c.object)}`, text: line(c) }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((x) => x.text);
}

// monologueOf — settle the subject from the world (optionally through an observer view) and read
// its inner monologue. opts is forwarded to settle (e.g. { observer }).
export async function monologueOf(root, subject, opts = {}) {
  const thing = await settle(root, subject, opts);
  return monologue(thing);
}

// CLI: node monologue.mjs <world> <subject> — render the entity's contradictions (its inner
// monologue), one line per ⊤ cell. A FORMATTER over the settled fiber, not a generator.
if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node monologue.mjs <world-dir> <subject>");
    process.exit(1);
  }
  const lines = await monologueOf(world, subject);
  if (lines.length === 0) {
    console.log(`${subject} holds no contradictions (a settled mind — nothing torn).`);
  } else {
    console.log(`${subject} — inner monologue (${lines.length} contradiction(s) held):`);
    for (const l of lines) console.log(`  ${l}`);
  }
}
