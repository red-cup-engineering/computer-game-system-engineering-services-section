// closing — the WORKING regime: the scott-continuous closure-rule engine. `working/` nests under
// `doing/` beside `observing/` and `responding/`: like them it READS being's settled residue (a
// fiber), but where observing quotes the fiber and responding composes a single message into it,
// WORKING iterates the fiber to a LEAST FIXED POINT under a monotone closure operator (Knaster-
// Tarski). It is the four-regime descent's scott-continuous floor: a generator that, given a
// settled fiber and a rule-system, fires every rule whose antecedent holds and APPENDS the
// consequent, then re-folds, until nothing new fires (quiescence).
//
// RULES ARE DATA. A closure rule is a predication read off a thing's fiber (a rule-system), NOT a
// registered JS function:
//   { rule:<id>, when:[ {predicate,object?} ... ], then:{predicate,object} }
// read off cells of the form (rule-id, "closure-rule", {when, then}) — the same "behaviour is the
// entity's fiber + a generic loop" stance ticking's `intends` already takes. `compile` (library/dsl)
// is the authoring bridge: a designer writes rule objects, the dsl emits the cells, SWARM ships the
// rule-system .jsonl. Nothing here is hard-coded physics.
//
// MONOTONE + APPEND-ONLY. The operator only ever ADDS positive evidence (fires a `then` cell that
// is not yet held); it never retracts, never mutates a prior settlement. So the fiber's knowledge
// only grows (≤_k monotone), the powerset of possible cells is finite for a finite rule-system, and
// the iteration is a monotone map on a finite lattice — Knaster-Tarski guarantees a least fixed
// point, reached in finitely many steps. That fixed point IS the closure.
//
// PARACONSISTENT — CLOSES AGAINST ⊤. A cell may settle to ⊤ (told both its predicate and its
// converse). The engine does NOT abort, does NOT explode, does NOT append falsifying counter-
// evidence to "repair" it: ⊤ is a HELD value. A rule whose antecedent reads a ⊤ cell still fires
// (holds(⊤) is true — positive evidence is present); the contradiction rides along in the fiber as a
// first-class situation. The closure converges WITH the ⊤ in it.
//
// closeFiber(fiber, rules, opts?) -> { fiber, fired:[{rule,then}], steps, quiescent, diverged }
//   PURE: folds rows in memory, never touches disk. The settled input fiber + a rule-system in,
//   the closed fiber out, plus the firing trace. Used by composing/ and re-used by ticking.
// closing({ root, subject, rules?, t }) -> { appended, fired, steps, quiescent }
//   EFFECTFUL: settle subject, read its rule-system (off its own fiber unless `rules` given), close,
//   and APPEND each fired consequent as an intra-action (deterministic t sub-stamps).

import being from "#being";
import { holds, isTop } from "#value";
import { settle, rowsFor, supersede, frontier } from "#substrate";
import doing from "#doing";
import iterate from "./iterate.mjs";

// A safety ceiling on iteration SCANS. A monotone closure over a finite reachable cell-space adds at
// least one cell per scan until it quiesces, so it reaches its LFP in at most (#reachable-cells)
// scans — well under this bound. Hitting the ceiling means the step kept producing FRESH cells every
// scan (an unbounded, APERIODIC rule-system): we stop and report diverged:true — interpretable
// divergence, NOT a crash, never a hang or a throw. This is the scott-continuous reading of
// aperiodicity (the descent's other regime), surfaced as data.
const MAX_STEPS = 4096;

// cellKey — a cell's identity for "is this consequent already held?": (predicate, object). Two rows
// asserting the same (predicate, object) are the same articulation; the fold settles them as one cell.
const cellKey = (predicate, object) => JSON.stringify([predicate, object]);

// antecedentHolds — does a rule's `when` hold against the current fiber? Each clause is a cell
// pattern {predicate, object?}: it is satisfied when the fiber carries a HOLDING cell (positive
// evidence present — t or ⊤; closing AGAINST ⊤, so a contested antecedent still fires) matching the
// predicate, and the object if the clause pins one. An empty `when` is a fact (fires once, then held).
function antecedentHolds(when, fiber) {
  for (const clause of when) {
    const hit = fiber.some(
      (c) => c.predicate === clause.predicate
        && (clause.object === undefined || c.object === clause.object)
        && holds(c.value),
    );
    if (!hit) return false;
  }
  return true;
}

// readRules — extract the rule-system from a settled fiber: every (rule-id, "closure-rule", {when,
// then}) cell that HOLDS. Rules are data, read like any other cell. A rule whose value is ⊤ or t
// fires (it is asserted); a retracted (�leq) rule is simply absent from the holding fiber. Each
// rule's `when` defaults to [] (a fact) and must carry a `then` {predicate, object}.
export function readRules(fiber) {
  const rules = [];
  for (const c of fiber) {
    if (c.predicate !== "closure-rule" || !holds(c.value)) continue;
    const spec = c.object;
    if (!spec || typeof spec !== "object" || !spec.then || typeof spec.then !== "object") continue;
    if (typeof spec.then.predicate !== "string") continue;
    rules.push({
      rule: typeof spec.rule === "string" ? spec.rule : c.object?.id ?? null,
      when: Array.isArray(spec.when) ? spec.when : [],
      then: { predicate: spec.then.predicate, object: spec.then.object },
    });
  }
  return rules;
}

// closeFiber — the PURE iterate-to-LFP. Given the subject, the settled rows already folded into
// `fiber`, the backing `rows` (so a newly fired consequent can be re-folded with its predecessors),
// and the rule-system, fire to quiescence. Returns the closed fiber, the firing trace, and whether
// it reached a fixed point (quiescent) or hit the ceiling (diverged — aperiodic non-termination
// surfaced, not crashed).
//
// closeFiber(subject, rows, rules, opts?) ->
//   { fiber, rows, fired:[{rule,predicate,object}], steps, quiescent, diverged }
export function closeFiber(subject, rows, rules, opts = {}) {
  const tFor = opts.t ?? ((seq) => `close:${String(seq).padStart(4, "0")}`);
  const fired = [];
  const held = new Set(); // (predicate,object) keys already in the fiber — monotone, fire once each

  // The STEP: one scan over the rule-system, firing every rule whose antecedent holds against the
  // current fiber and whose consequent is not yet held. APPEND-ONLY (concat a fresh row, never
  // mutate), then re-fold so the next round reads the grown fiber. `progress` = did anything fire?
  const step = (state) => {
    let work = state.rows;
    let fiber = state.fiber;
    let progress = false;
    for (const r of rules) {
      const key = cellKey(r.then.predicate, r.then.object);
      if (held.has(key)) continue;                    // already in the fiber — fire once (monotone)
      if (!antecedentHolds(r.when, fiber)) continue;  // antecedent not satisfied this round
      const row = { e: subject, a: r.then.predicate, v: r.then.object, t: tFor(fired.length + 1) };
      work = work.concat([row]);
      held.add(key);
      fired.push({ rule: r.rule, predicate: r.then.predicate, object: r.then.object });
      progress = true;
    }
    if (progress) fiber = being(subject, work).fiber; // re-fold: read the grown fiber next round
    return { state: { rows: work, fiber }, progress };
  };

  const seed = (() => {
    const fiber = being(subject, rows).fiber;
    for (const c of fiber) if (holds(c.value)) held.add(cellKey(c.predicate, c.object));
    return { rows: rows.slice(), fiber };
  })();

  // Drive the ONE iterate-to-quiescence operator. The ceiling surfaces aperiodic non-termination as
  // diverged:true (never a throw or a hang) — the scott-continuous reading of divergence.
  const run = iterate(seed, step, { max: MAX_STEPS });
  return {
    fiber: run.state.fiber,
    rows: run.state.rows,
    fired,
    steps: run.steps,
    quiescent: run.quiescent,
    diverged: run.diverged,
  };
}

// contested — the ⊤ cells the closed fiber HOLDS as situations (the paraconsistency witness: these
// rode through the closure intact, never repaired). A reader (a renderer, a test) can show them.
export function contested(fiber) {
  return fiber.filter((c) => isTop(c.value)).map((c) => ({ predicate: c.predicate, object: c.object }));
}

// closing — the EFFECTFUL driver. Settle `subject`, take its rule-system (from its own fiber, unless
// an explicit `rules` array is handed in), close to LFP, and APPEND each fired consequent to disk as
// an intra-action stamped under `t` (sub-stamped /close:NNNN so the firings sort after the base t and
// replay deterministically). Returns what was appended, the firing trace, the step count, and
// whether it quiesced. Append-only; the trace stays whole; a ⊤ in the fiber does not abort the write.
export default async function closing({ root, subject, rules, t, observer } = {}) {
  if (!root || subject == null || t == null) throw new TypeError("closing: root, subject, t are required");
  const thing = await settle(root, subject, observer ? { observer } : {});
  const ruleSystem = rules ?? readRules(thing.fiber);
  // PURE close over the subject's OWN superseded rows (so ⊤ — the converse face — is preserved and
  // rides through the closure, not flattened to its positive presence). The same frontier/supersede
  // lens settle used, so closeFiber's re-fold matches the settled fiber the rules were read off.
  let rows = await rowsFor(root, subject);
  if (observer) rows = frontier(rows, observer);
  rows = supersede(rows);
  const result = closeFiber(subject, rows, ruleSystem, {
    t: (seq) => `${t}/close:${String(seq).padStart(4, "0")}`,
  });
  const appended = [];
  for (const f of result.fired) {
    const { row } = await doing({
      root, subject, predicate: f.predicate, object: f.object,
      t: `${t}/close:${String(appended.length + 1).padStart(4, "0")}`,
    });
    appended.push(row);
  }
  return {
    appended,
    fired: result.fired,
    steps: result.steps,
    quiescent: result.quiescent,
    diverged: result.diverged,
    contested: contested(result.fiber),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [world, subject] = process.argv.slice(2);
  if (!world || !subject) {
    console.error("usage: node closing.mjs <world> <subject>");
    process.exit(2);
  }
  const out = await closing({ root: world, subject, t: "close:manual" });
  console.log(JSON.stringify({ fired: out.fired, steps: out.steps, quiescent: out.quiescent, contested: out.contested }));
}
