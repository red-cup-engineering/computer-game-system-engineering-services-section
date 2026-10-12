// practice — XP as CLOSURE CONVERGENCE. A SKILL is a predicate an actor HOLDS AT A DEGREE: the
// cell `skill:<name>` on the actor's fiber, whose bilattice value (plus the supporting determined
// cells) IS the degree. Practising files reinforcing evidence; the skill cell settles toward its
// fixed point as evidence accrues. There is NO level number and NO designed gate — "advancement"
// is just the sub-fiber CLOSING (see advancing/advance.mjs). NPC and player share the EXACT same
// path: practice differs by `actor`/`agent` only, never by `mover`.
//
// SKILL CONVENTION: a skill lives on the predicate `skill:<name>`. A SUCCESS files a positive row
//   {e:actor, a:"skill:<name>", v:"practiced"} — practising affirms the cell (→ t). A FAIL files
//   the CONVERSE predicate `unskill:<name>`, declared `(skill:<name> has-converse unskill:<name>)`
//   so being() folds it as NEGATIVE evidence for the skill cell. A skill that is only ever
//   succeeded settles to t; only ever failed → f; both → ⊤ (a contested skill — a real situation,
//   e.g. learned-then-regressed). `skill:`-prefixed predicates ACCRUE (they are NOT functional):
//   every practice event survives the fold so contradictory evidence settles to ⊤ rather than the
//   latest-t face silently winning, and the append-only trace doubles as the XP / practice history.
//
// practice({ root, agent, actor, skill, outcome, t }) -> { rows, level }
//   outcome : "success" | "fail"
//   t       : optional deterministic stamp PREFIX (default "practice"); rows are stamped
//             `<prefix>:NNNNNN` from a counter — NO Date, NO RNG, replay-byte-stable.
//   rows    : the {row,id} results doing()/declareConverse appended, in order
//   level   : { skill, predicate, converse, outcome } — the degree handle for this practice

import doing, { declareConverse } from "#doing";

// A skill cell lives on `skill:<name>`; its converse (negative evidence) on `unskill:<name>`.
export const skillPredicate = (skill) => `skill:${skill}`;
export const conversePredicate = (skill) => `unskill:${skill}`;

export default async function practice({ root, agent, actor, skill, outcome, t }) {
  if (!root || actor == null || skill == null || outcome == null) {
    throw new TypeError("practice: root, actor, skill, outcome are required");
  }
  if (outcome !== "success" && outcome !== "fail") {
    throw new TypeError(`practice: outcome must be "success" or "fail", got ${outcome}`);
  }

  // Deterministic counter t: `<prefix>:NNNNNN`. No clock, no RNG — replay-byte-stable.
  const prefix = t ?? "practice";
  let seq = 0;
  const stamp = () => `${prefix}:${String(++seq).padStart(6, "0")}`;

  const predicate = skillPredicate(skill);
  const converse = conversePredicate(skill);
  const rows = [];

  // Both faces target the SAME cell: being keys a cell by [predicate, object], and the converse
  // orients at the positive predicate — so positive and negative evidence only fuse (→ ⊤ when
  // both are present) if they carry the SAME object. The object is the skill name itself.
  if (outcome === "success") {
    // Positive reinforcing evidence: the actor practised the skill (affirms the cell → t).
    rows.push(await doing({ root, agent, subject: actor, predicate, object: skill, t: stamp() }));
  } else {
    // Negative evidence: file the CONVERSE so the skill can settle toward f / ⊤. Declare the
    // converse on the actor's own trace (idempotent — re-declaring is just another row being()
    // reads identically), then file the unskill row on the SAME object.
    rows.push({ row: { e: predicate, a: "has-converse", v: converse, t: stamp() } });
    await declareConverse(root, actor, predicate, converse, rows[rows.length - 1].row.t);
    rows.push(await doing({ root, agent, subject: actor, predicate: converse, object: skill, t: stamp() }));
  }

  return { rows, level: { skill, predicate, converse, outcome } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, actor, skill, outcome] = process.argv.slice(2);
  if (!world || !actor || !skill || !outcome) {
    console.error("usage: node practice.mjs <world> <actor> <skill> <success|fail>");
    process.exit(2);
  }
  const r = await practice({ root: world, actor, skill, outcome });
  console.log(JSON.stringify(r.level));
}
