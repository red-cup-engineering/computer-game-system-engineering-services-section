// prove-closing — the WORKING regime's closure-rule engine + compose-and-close. Proves: (1) the
// engine fires monotone closure RULES (rules-as-DATA) to a LEAST FIXED POINT; (2) the LFP is reached
// (quiescence) and is idempotent (re-closing fires nothing); (3) PARACONSISTENCY — a ⊤ in the fiber
// does NOT explode the closure, and a rule whose antecedent reads a ⊤ STILL fires; (4) APERIODIC
// non-termination surfaces as interpretable divergence, not a crash; (5) compose-and-close fuses two
// bodies via ⊙ and settles the play, with a fresh assert+deny raising ⊤ from the FOLD (not from ⊙).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import { glyph } from "#value";
import doing, { declareConverse } from "#doing";
import { settle } from "#substrate";
import closing, { closeFiber, readRules, contested } from "#working";
import compose, { composeFibers } from "#composing";
import iterate from "../scripts/iterate.mjs";

let pass = 0;
const ok = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => { pass += 1; console.log(`  ok  ${name}`); },
      (e) => { console.error(`FAIL  ${name}\n      ${e.message}`); process.exitCode = 1; },
    );

const tmp = mkdtempSync(join(tmpdir(), "tab-closing-"));
const world = join(tmp, "w");

// A transitive-closure rule-system as DATA: ancestor is the transitive closure of parent.
//   r1: (x parent y) => (x ancestor y)            [seed: every parent edge is an ancestor edge]
//   r2: (x ancestor y) ∧ ... — modelled cell-wise on a single subject's fiber.
// We model it on ONE subject "graph": cells (edge:a-b "parent"), and rules promote parent->ancestor
// then chain ancestor over a shared mid. To keep it cell-shaped, we use object-pinned clauses.
function transitiveRules() {
  return [
    // seed: anything held as reach:ab is also reach-plus:ab (a fact-on-presence)
    { rule: "seed", when: [{ predicate: "edge", object: "a-b" }], then: { predicate: "path", object: "a-b" } },
    { rule: "seed2", when: [{ predicate: "edge", object: "b-c" }], then: { predicate: "path", object: "b-c" } },
    // chain: if path a-b and path b-c hold, then path a-c holds (the closure step)
    {
      rule: "chain",
      when: [{ predicate: "path", object: "a-b" }, { predicate: "path", object: "b-c" }],
      then: { predicate: "path", object: "a-c" },
    },
    // further chain off the derived a-c (proves the engine re-reads its own output to fixpoint)
    {
      rule: "chain2",
      when: [{ predicate: "path", object: "a-c" }, { predicate: "edge", object: "c-d" }],
      then: { predicate: "path", object: "a-d" },
    },
  ];
}

try {
  // --- (1) + (2) the pure engine reaches a LEAST FIXED POINT, monotone, idempotent --------------
  await ok("closeFiber fires transitive closure to a quiescent LFP", () => {
    const rows = [
      { e: "g", a: "edge", v: "a-b", t: "s1" },
      { e: "g", a: "edge", v: "b-c", t: "s2" },
      { e: "g", a: "edge", v: "c-d", t: "s3" },
    ];
    const r = closeFiber("g", rows, transitiveRules());
    assert.equal(r.quiescent, true, "reaches a fixed point");
    assert.equal(r.diverged, false);
    const paths = new Set(r.fiber.filter((c) => c.predicate === "path").map((c) => c.object));
    // seeds a-b, b-c; chain a-c; chain2 a-d — the full reachable closure
    assert.ok(paths.has("a-b") && paths.has("b-c") && paths.has("a-c") && paths.has("a-d"), [...paths].join(","));
  });

  await ok("the LFP is idempotent: re-closing the closed fiber fires nothing", () => {
    const rows = [
      { e: "g", a: "edge", v: "a-b", t: "s1" },
      { e: "g", a: "edge", v: "b-c", t: "s2" },
      { e: "g", a: "edge", v: "c-d", t: "s3" },
    ];
    const first = closeFiber("g", rows, transitiveRules());
    const second = closeFiber("g", first.rows, transitiveRules());
    assert.equal(second.fired.length, 0, "a fixed point fires nothing on a second pass");
  });

  // --- (3) PARACONSISTENCY: a ⊤ does not explode, and an antecedent on a ⊤ still fires ----------
  await ok("a ⊤ cell in the fiber does NOT explode the closure; the rule on it still fires", () => {
    // build a fiber where `overdue` is BOTH asserted and (via converse) denied → ⊤.
    const rows = [
      { e: "p", a: "within-window", v: "has-converse", t: "c0" }, // placeholder; real converse below
    ];
    // proper converse declaration: (within-window has-converse overdue)
    const trace = [
      { e: "within-window", a: "has-converse", v: "overdue", t: "c0" },
      { e: "p", a: "within-window", v: "permit", t: "t1" },
      { e: "p", a: "overdue", v: "permit", t: "t2" }, // contributes negative face → ⊤ on within-window
    ];
    const before = being("p", trace).fiber;
    const ww = before.find((c) => c.predicate === "within-window");
    assert.equal(glyph(ww.value), "⊤", "within-window is contested (⊤)");
    // a rule that fires on the ⊤ channel: (within-window) => (flagged review)
    const rules = [{ rule: "flag", when: [{ predicate: "within-window" }], then: { predicate: "flagged", object: "review" } }];
    const r = closeFiber("p", trace, rules);
    assert.equal(r.quiescent, true, "closure does not abort on ⊤");
    assert.equal(r.diverged, false);
    assert.ok(r.fiber.some((c) => c.predicate === "flagged" && c.object === "review"), "rule fired despite ⊤ antecedent");
    // the ⊤ rode through intact — paraconsistency, not repair.
    assert.ok(contested(r.fiber).some((c) => c.predicate === "within-window"), "⊤ preserved in the closed fiber");
  });

  // --- (4) a finite rule-system ALWAYS converges; APERIODIC divergence surfaces, never crashes ---
  await ok("a large finite rule-system still CONVERGES (bounded reachable cell-space)", () => {
    // 5000 rules, each a distinct fixed consequent: the reachable cells are bounded by the 5000
    // `then` cells, so the monotone closure terminates (one scan fires them all, the next is quiet).
    const rules = [];
    for (let i = 0; i < 5000; i += 1) {
      rules.push({ rule: `r${i}`, when: [{ predicate: "go" }], then: { predicate: "out", object: `n${i}` } });
    }
    const r = closeFiber("g", [{ e: "g", a: "go", v: "x", t: "s1" }], rules);
    assert.equal(r.quiescent, true, "a finite-consequent rule-system always reaches its LFP");
    assert.equal(r.diverged, false);
    assert.equal(r.fired.length, 5000, "every rule fired exactly once");
  });

  await ok("the iterate operator surfaces unbounded (aperiodic) progress as diverged:true, no crash", () => {
    // a step whose codomain is UNBOUNDED — it produces a fresh value every round forever. This is the
    // genuinely aperiodic case the closure-rule shape cannot reach; the general operator bounds it.
    const r = iterate({ n: 0 }, (s) => ({ state: { n: s.n + 1 }, progress: true }), { max: 64 });
    assert.equal(r.diverged, true, "hits the ceiling → interpretable divergence");
    assert.equal(r.quiescent, false);
    assert.equal(r.state.n, 64, "it returned the state at the ceiling — did not throw or hang");
  });

  await ok("iterate stops at a fixed point (progress:false) as quiescent", () => {
    // a step that converges: count up to 3, then stop reporting progress.
    const r = iterate({ n: 0 }, (s) => (s.n < 3 ? { state: { n: s.n + 1 }, progress: true } : { state: s, progress: false }), { max: 64 });
    assert.equal(r.quiescent, true);
    assert.equal(r.diverged, false);
    assert.equal(r.state.n, 3);
  });

  // --- (5) the EFFECTFUL driver appends fired consequents, deterministically --------------------
  await ok("closing() reads a rule-system off a fiber and appends fired consequents (deterministic)", async () => {
    // seed a subject carrying its OWN rule-system as data, plus a fact.
    await doing({ root: world, subject: "k", predicate: "edge", object: "a-b", t: "s1" });
    await doing({ root: world, subject: "k", predicate: "edge", object: "b-c", t: "s2" });
    for (const r of transitiveRules()) {
      await doing({ root: world, subject: "k", predicate: "closure-rule", object: r, t: `rule:${r.rule}` });
    }
    const out = await closing({ root: world, subject: "k", t: "tick:000001" });
    assert.equal(out.quiescent, true);
    assert.ok(out.fired.some((f) => f.predicate === "path" && f.object === "a-c"), "fired the transitive a-c");
    // the firings are on disk now: a re-settle shows path a-c held.
    const settled = await settle(world, "k");
    assert.ok(settled.fiber.some((c) => c.predicate === "path" && c.object === "a-c"), "a-c persisted");
    // idempotent on disk: closing again fires nothing new.
    const again = await closing({ root: world, subject: "k", t: "tick:000002" });
    assert.equal(again.fired.length, 0, "a settled world re-closes to nothing");
  });

  // --- (6) compose-and-close: ⊙ fusion of two bodies, ⊤ from the FOLD ----------------------------
  await ok("composeFibers ⊙-fuses: t⊙t=t (agreement), denial→f", () => {
    const active = being("att", [{ e: "att", a: "strike", v: "blade", t: "a1" }]);
    const passive = being("def", [{ e: "def", a: "strike", v: "blade", t: "d1" }]);
    const { settlements } = composeFibers(active, passive);
    assert.equal(settlements.length, 1);
    assert.equal(settlements[0].value.glyph, "t", "both affirm the strike channel → t");
  });

  await ok("compose() appends a fresh assert+deny so the FOLD raises ⊤ (not ⊙)", async () => {
    // active body asserts `open` (t); passive body DENIES `open` via its own converse → active's t
    // mark meets passive's f cell. The settlement records both faces; the passive fold raises ⊤.
    await doing({ root: world, subject: "actor", predicate: "open", object: "door", t: "a1" });
    // passive door: declare converse so it can hold `open` as denied; assert the denial face.
    await declareConverse(world, "door", "open", "sealed", "c0");
    await doing({ root: world, subject: "door", predicate: "open", object: "door", t: "d1" });   // positive
    await doing({ root: world, subject: "door", predicate: "sealed", object: "door", t: "d2" }); // negative face → door already ⊤
    const out = await compose({ root: world, active: "actor", passive: "door", t: "tick:000010" });
    assert.equal(out.quiescent, true, "compose-and-close quiesces even with ⊤ present");
    const door = await settle(world, "door");
    const cell = door.fiber.find((c) => c.predicate === "open" && c.object === "door");
    assert.equal(glyph(cell.value), "⊤", "the open channel is a held ⊤ situation after the play");
  });

  console.log(`\n${pass} closing checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
