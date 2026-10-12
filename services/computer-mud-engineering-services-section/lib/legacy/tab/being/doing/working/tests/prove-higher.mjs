// prove-higher — PHASE 3, HIGHER STRUCTURES. Parameterize the WORKING engine by the BODY. Proves the
// five parts, all on the existing FLOOR (being/value/working/closeFiber), all preserving the four-corner
// bilattice + append-only + paraconsistent (closes AGAINST ⊤) law:
//   (a) HABITUS-CLOSURE  — per-body rules acquired from the body's settlement HISTORY, firing on
//       matching predicates, transposable across domains, generating hysteresis; disposition (learned)
//       distinct from position (current relations).
//   (b) DISPATCH         — agency-as-respond: work as a variable-binding triple operate(?,input,?);
//       bind the agent by max-t/min-f on capability; the three-check gate (capability/authority/capacity).
//   (c) GOVERNING        — ⊤-processing: symbolic-violence as a VIEW (history intact), affect-routing
//       (append an affect beside a ⊤, never delete), the reproduction REGIME (strict/scott/aperiodic).
//   (d) WHY seam         — public why(root,subject,predicate,object): value + witness {pos,neg} + which
//       closure rules fired (replayable derivation).
//   (e) FRACTAL RE-ENTRY — a settled actor's fiber seeds a nested internal thing-structure (a LOGICAL
//       projection at a different grain, NOT a separate disk root).

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import { glyph, isTop } from "#value";
import doing, { declareConverse } from "#doing";
import { settle } from "#substrate";
import { closeFiber } from "#working";
import { rowId } from "#eavt-row";

import { acquire, habitusCells, habitusRules, transpose, dispositionsOf, HABITUS_MARK } from "#habitus";
import { planOperate, capabilityRank, gate, dispatch, agency, executeCells } from "#dispatch";
import why, { whyFiber } from "#why";
import { reenter, composite, facetOf, depthOf } from "#reentry";
import { regimeBudget, contestedCells, govern, REGIMES } from "#governing";
import { apparatusView, misrecognized, suppresses } from "#violence";
import { affectRules, affectCells, contestedAffects, route, AFFECT_PREFIX } from "#affect";

let pass = 0;
const ok = (name, fn) =>
  Promise.resolve().then(fn).then(
    () => { pass += 1; console.log(`  ok  ${name}`); },
    (e) => { console.error(`FAIL  ${name}\n      ${e.stack}`); process.exitCode = 1; },
  );

const tmp = mkdtempSync(join(tmpdir(), "tab-higher-"));
const world = join(tmp, "w");

try {
  // ============================================================================================
  // (a) HABITUS-CLOSURE
  // ============================================================================================
  await ok("habitus rules are ACQUIRED from a body's settlement HISTORY (not authored, not global)", () => {
    // the body settled "provoked -> struck" twice in its past — a regularity it internalizes.
    const history = [
      { when: "provoked", then: "struck" },
      { when: "provoked", then: "struck" },
      { when: "greeted", then: "struck" }, // once — below threshold, not a disposition
    ];
    const disp = acquire(history); // default threshold 2
    assert.equal(disp.length, 1, "only the recurring co-occurrence crystallizes");
    assert.equal(disp[0].when[0].predicate, "provoked");
    assert.equal(disp[0].then.predicate, "struck");
    assert.equal(disp[0][HABITUS_MARK], true, "marked as habitus (learned), not authored");
    assert.equal(disp[0].strength, 2, "recurrence count");
  });

  await ok("an acquired disposition FIRES automatically in the WORKING engine off the body's OWN fiber", () => {
    const disp = acquire([{ when: "provoked", then: "struck" }, { when: "provoked", then: "struck" }]);
    const cells = habitusCells("brawler", disp);
    // file the disposition on the body, then present it with a matching predicate; it fires.
    const trace = [
      ...cells.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `h${i}` })),
      { e: "brawler", a: "provoked", v: "rival", t: "t1" },
    ];
    const r = closeFiber("brawler", trace, []); // rules read OFF the fiber (closeFiber given the fiber's rules)
    // closeFiber takes explicit rules; read them off the fiber first (the engine reads the body's own).
    const fiber = being("brawler", trace).fiber;
    const rules = habitusRules(fiber);
    assert.equal(rules.length, 1, "the body carries one acquired disposition");
    const closed = closeFiber("brawler", trace, rules);
    assert.ok(closed.fired.some((f) => f.predicate === "struck"), "the disposition fired on the matching predicate");
  });

  await ok("DISPOSITION (learned firing) is DISTINCT from POSITION (current relations)", () => {
    const disp = acquire([{ when: "provoked", then: "struck" }, { when: "provoked", then: "struck" }]);
    const trace = [
      ...habitusCells("b", disp).map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `h${i}` })),
      { e: "b", a: "located-in", v: "tavern", t: "t1" }, // a current RELATION (position), not a disposition
    ];
    const fiber = being("b", trace).fiber;
    const dispositions = dispositionsOf(fiber);
    assert.equal(dispositions.length, 1, "one learned disposition");
    assert.ok(dispositions[0][HABITUS_MARK], "it is a disposition");
    // the located-in cell is position, NOT in the dispositions read.
    assert.ok(!dispositions.some((d) => d.rule.includes("located-in")), "position is not disposition");
  });

  await ok("HYSTERESIS: a disposition fires even when the present position no longer warrants it", () => {
    // acquired from a past where provocation led to striking; fires NOW on a bare `provoked` with no rival,
    // no current hostility — the disposition lags the field (Bourdieu's hysteresis). `since` records origin.
    const disp = acquire([{ when: "provoked", then: "struck" }, { when: "provoked", then: "struck" }]);
    assert.equal(disp[0].since, 1, "the hysteresis origin (first settlement it appeared)");
    const trace = [
      ...habitusCells("vet", disp).map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `h${i}` })),
      { e: "vet", a: "provoked", v: "shadow", t: "t1" }, // a mere shadow — yet the disposition still fires
    ];
    const fiber = being("vet", trace).fiber;
    const closed = closeFiber("vet", trace, habitusRules(fiber));
    assert.ok(closed.fired.some((f) => f.predicate === "struck"), "disposition outlives its warranting conditions");
  });

  await ok("TRANSPOSITION: a disposition acquired in one DOMAIN transposes to another", () => {
    const disp = acquire([
      { when: "combat:aggress", then: "combat:dominate" },
      { when: "combat:aggress", then: "combat:dominate" },
    ]);
    const moved = transpose(disp[0], "combat", "trade");
    assert.equal(moved.when[0].predicate, "trade:aggress", "re-keyed to the new domain");
    assert.equal(moved.then.predicate, "trade:dominate");
    assert.deepEqual(moved.transposed, { from: "combat", to: "trade" });
    // and it FIRES in the new domain:
    const trace = [{ e: "x", a: "trade:aggress", v: "deal", t: "t1" }];
    const closed = closeFiber("x", trace, [moved]);
    assert.ok(closed.fired.some((f) => f.predicate === "trade:dominate"), "the structuring structure applied across domains");
  });

  // ============================================================================================
  // (b) DISPATCH / agency-as-respond
  // ============================================================================================
  await ok("WORK is a variable-binding triple: plan OPENS operate(?agent, input, ?output)", () => {
    const { subject, cells } = planOperate("ore", "smelt");
    const fiber = being(subject, cells.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `t${i}` }))).fiber;
    // ?agent and ?output are articulated HOLES (potential-cells, ontology part a).
    const arts = fiber.filter((c) => c.predicate === "articulating");
    assert.ok(arts.some((c) => c.object.predicate === "agent"), "?agent is an open hole");
    assert.ok(arts.some((c) => c.object.predicate === "output"), "?output is an open hole");
    assert.ok(fiber.some((c) => c.predicate === "input" && c.object === "ore"), "the input is pinned");
  });

  await ok("DISPATCH binds the agent by max-t / min-f on capability predicates", () => {
    const candidates = [
      { body: "novice", fiber: being("novice", []).fiber }, // ⊥ on capable — unknown
      { body: "smith", fiber: being("smith", [
        { e: "smith", a: "capable-of:smelt", v: true, t: "t1" },        // t
        { e: "smith", a: "delegated:smelt", v: "guild", t: "t2" },      // authorized
      ]).fiber },
      { body: "drunk", fiber: being("drunk", [
        { e: "capable-of:smelt", a: "has-converse", v: "not-capable-of:smelt", t: "c1" },
        { e: "drunk", a: "capable-of:smelt", v: true, t: "t1" },
        { e: "drunk", a: "not-capable-of:smelt", v: true, t: "t2" },    // ⊤ — contested capability
        { e: "drunk", a: "delegated:smelt", v: "guild", t: "t3" },
      ]).fiber },
    ];
    const r = dispatch(candidates, "smelt", { requireAuthority: true });
    assert.equal(r.agent, "smith", "the uncontested-capable, authorized body wins (max-t)");
    // the ⊤-capable body still RANKS (closes against ⊤), just below the t body.
    assert.ok(r.ranking.some((p) => p.body === "drunk"), "a contested-capable body is still a candidate");
    assert.ok(r.rejected.some((x) => x.body === "novice" && x.failed === "capability"),
      "the novice fails the FIRST gate — ⊥ capability ⊙ demand = ⊥, not t (gate excludes, never faults)");
  });

  await ok("the THREE-CHECK GATE: capability=⊙→t, authority=delegation present, capacity=load<max", () => {
    const full = being("worker", [
      { e: "worker", a: "capable-of:haul", v: true, t: "t1" },
      { e: "worker", a: "delegated:haul", v: "boss", t: "t2" },
      { e: "worker", a: "load", v: 1, t: "t3" },
      { e: "worker", a: "max-load", v: 3, t: "t4" },
    ]).fiber;
    const g = gate(full, "haul");
    assert.deepEqual([g.capability, g.authority, g.capacity], [true, true, true]);
    assert.equal(g.dispatchable, true);
    // overloaded: capacity fails.
    const over = being("tired", [
      { e: "tired", a: "capable-of:haul", v: true, t: "t1" },
      { e: "tired", a: "delegated:haul", v: "boss", t: "t2" },
      { e: "tired", a: "load", v: 3, t: "t3" },
      { e: "tired", a: "max-load", v: 3, t: "t4" },
    ]).fiber;
    assert.equal(gate(over, "haul").capacity, false, "load NOT < max → no capacity");
    assert.equal(gate(over, "haul").dispatchable, false);
    // unauthorized: authority fails.
    const unauth = being("loner", [{ e: "loner", a: "capable-of:haul", v: true, t: "t1" }]).fiber;
    assert.equal(gate(unauth, "haul").authority, false, "no delegation → no authority");
  });

  await ok("AGENCY is the DEGREE a body can respond to the op (0 when gated out, t→1, ⊤→0.75)", () => {
    const capable = being("a", [
      { e: "a", a: "capable-of:op", v: true, t: "t1" },
      { e: "a", a: "delegated:op", v: "g", t: "t2" },
    ]).fiber;
    assert.equal(agency(capable, "op"), 1, "full t capability, gate passed → agency 1");
    // a ⊤-capable (contested) body that passes authority/capacity has SOME agency, below the t body.
    const contested = being("c", [
      { e: "capable-of:op", a: "has-converse", v: "not-capable-of:op", t: "c1" },
      { e: "c", a: "capable-of:op", v: true, t: "t1" },
      { e: "c", a: "not-capable-of:op", v: true, t: "t2" }, // ⊤ capability
      { e: "c", a: "delegated:op", v: "g", t: "t3" },
    ]).fiber;
    assert.equal(agency(contested, "op"), 0.75, "⊤ capability, gate-passed (closes against ⊤) → 0.75");
    // a ⊥-capability body does NOT pass the gate: ⊙(⊥, demand)=⊥ is not t → agency 0.
    const incapable = being("b", []).fiber;
    assert.equal(agency(incapable, "op", { requireAuthority: false }), 0, "⊥ capability ⊙ demand = ⊥ → not dispatchable → 0");
    assert.equal(agency(incapable, "op"), 0, "no capability/authority → gated out → agency 0");
  });

  await ok("EXECUTE completes the triple: binds ?agent, determines ?output, bumps load", () => {
    const { cells } = executeCells("smith", "ore", "smelt", "ingot", { load: 1 });
    assert.ok(cells.some((c) => c.predicate === "agent" && c.object === "smith"), "?agent bound");
    assert.ok(cells.some((c) => c.predicate === "output" && c.object === "ingot"), "?output determined");
    assert.ok(cells.some((c) => c.predicate === "load" && c.object === 2), "load bumped (capacity consumed)");
  });

  // ============================================================================================
  // (c) GOVERNING — ⊤-PROCESSING
  // ============================================================================================
  await ok("REPRODUCTION REGIME: strict governs ALL ⊤, scott-continuous a BUDGET, aperiodic NONE", () => {
    assert.deepEqual(REGIMES, ["strict", "scott-continuous", "aperiodic"]);
    assert.equal(regimeBudget("strict", 5), 5, "strict — all five contradictions managed at once");
    assert.equal(regimeBudget("scott-continuous", 5, { budget: 2 }), 2, "scott — a budget per pass");
    assert.equal(regimeBudget("aperiodic", 5), 0, "aperiodic — none; the order drifts");
    assert.throws(() => regimeBudget("monarchic", 1), /regime/);
  });

  await ok("AFFECT-ROUTING rewrites a structural ⊤ into an affect cell by APPENDING, never deleting", () => {
    // a body recognized AND excluded at champion-at (⊤). The routing APPENDS affect:defiance beside it.
    // (The excluded-face FOLDS INTO champion-at's neg face — raising the ⊤ — so the routing is applied by
    // ⊤-detection (affectCells/governing), not the generic engine which cannot tell t from ⊤.)
    const trace = [
      { e: "champion-at", a: "has-converse", v: "excluded-champion-at", t: "c1" },
      { e: "hero", a: "champion-at", v: "hero", t: "t1" },
      { e: "hero", a: "excluded-champion-at", v: "hero", t: "t2" }, // both faces → ⊤
    ];
    const fiber = being("hero", trace).fiber;
    const champ = fiber.find((c) => c.predicate === "champion-at");
    assert.equal(glyph(champ.value), "⊤", "structural contradiction is ⊤");
    assert.equal(route(fiber, [{ on: "champion-at", feel: "defiance" }])[0].present, true, "the ⊤-condition is present");
    // the affect rows to append (⊤-detected), then fold them in beside the ⊤.
    const appends = affectCells("hero", fiber, [{ on: "champion-at", feel: "defiance" }]);
    assert.deepEqual(appends, [{ subject: "hero", predicate: "affect:defiance", object: "champion-at" }]);
    const after = being("hero", [...trace, ...appends.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `a${i}` }))]);
    // the ⊤ is STILL there (preserved) AND an affect was appended beside it.
    assert.equal(after.fiber.find((c) => c.predicate === "champion-at").value.glyph, "⊤", "the ⊤ is PRESERVED — not repaired, not deleted");
    assert.deepEqual(contestedAffects(after.fiber), [{ kind: "defiance", on: "champion-at" }], "an affect appended beside the ⊤");
    // the routing's data form is also shippable as a closure rule:
    assert.equal(affectRules([{ on: "champion-at", feel: "defiance" }])[0].then.predicate, "affect:defiance");
  });

  await ok("affect-routing fires ONLY on a genuine ⊤, not on a plain t", () => {
    // hero recognized but NOT excluded — a plain t, no contradiction. The routing must NOT fire.
    const fiber = being("hero", [
      { e: "champion-at", a: "has-converse", v: "excluded-champion-at", t: "c1" },
      { e: "hero", a: "champion-at", v: "hero", t: "t1" }, // t only
    ]).fiber;
    assert.equal(affectCells("hero", fiber, [{ on: "champion-at", feel: "defiance" }]).length, 0, "no ⊤ → no affect routed");
  });

  await ok("govern() processes ⊤ cells under a regime; aperiodic DEFERS them (order drifts)", () => {
    const fiber = being("field", [
      { e: "p1", a: "has-converse", v: "excluded-p1", t: "c1" },
      { e: "p2", a: "has-converse", v: "excluded-p2", t: "c2" },
      { e: "field", a: "p1", v: "x", t: "t1" }, { e: "field", a: "excluded-p1", v: "x", t: "t2" }, // ⊤
      { e: "field", a: "p2", v: "y", t: "t3" }, { e: "field", a: "excluded-p2", v: "y", t: "t4" }, // ⊤
    ]).fiber;
    assert.equal(contestedCells(fiber).length, 2, "two contradictions in the field");
    const strict = govern({ subject: "field", fiber, regime: "strict", routings: [{ on: "p1", feel: "shame" }, { on: "p2", feel: "rage" }] });
    assert.equal(strict.processed.length, 2, "strict governs both");
    assert.equal(strict.rate, 1, "full reproduction this pass");
    assert.equal(strict.affectRules.length, 2, "both routed (shippable rule form)");
    assert.equal(strict.affectAppends.length, 2, "both ⊤ cells get an affect APPENDED (⊤-detected)");
    // the appends route the ⊤ into a feeling WITHOUT touching it:
    const governed = being("field", [...fiber.flatMap(() => []), ...strict.affectAppends.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `g${i}` })),
      { e: "p1", a: "has-converse", v: "excluded-p1", t: "c1" }, { e: "field", a: "p1", v: "x", t: "t1" }, { e: "field", a: "excluded-p1", v: "x", t: "t2" }]);
    assert.equal(governed.fiber.find((c) => c.predicate === "p1").value.glyph, "⊤", "the governed ⊤ is preserved");
    assert.ok(contestedAffects(governed.fiber).some((a) => a.kind === "shame"), "the affect rides beside it");
    const drift = govern({ fiber, regime: "aperiodic", routings: [{ on: "p1", feel: "shame" }] });
    assert.equal(drift.processed.length, 0, "aperiodic governs none");
    assert.equal(drift.deferred.length, 2, "both contradictions carry — the field is out of joint");
    const lazy = govern({ fiber, regime: "scott-continuous", budget: 1, routings: [{ on: "p1", feel: "shame" }] });
    assert.equal(lazy.processed.length, 1, "scott governs one per pass");
    assert.equal(lazy.deferred.length, 1, "the rest carries to next pass");
  });

  await ok("SYMBOLIC VIOLENCE is a VIEW: an apparatus suppresses a ⊤ on READ; history stays intact", () => {
    const trace = [
      { e: "champion-at", a: "has-converse", v: "excluded-champion-at", t: "c1" },
      { e: "claimant", a: "champion-at", v: "claimant", t: "t1" },          // recognized
      { e: "claimant", a: "excluded-champion-at", v: "claimant", t: "t2" }, // excluded → ⊤
    ];
    const trueFiber = being("claimant", trace, { witness: true });
    const champ = trueFiber.fiber.find((c) => c.predicate === "champion-at");
    assert.equal(glyph(champ.value), "⊤", "without the apparatus it is a contested ⊤");
    // the dominant apparatus suppresses the POSITIVE face → the claimant reads EXCLUDED (recognition withheld).
    const apparatus = { observer: "dominant", suppress: [{ predicate: "champion-at", face: "pos" }] };
    assert.equal(suppresses(apparatus, "champion-at"), "pos");
    const viewRows = apparatusView(trace, trueFiber, apparatus, rowId);
    const viewFiber = being("claimant", viewRows, { witness: true });
    const seen = viewFiber.fiber.find((c) => c.predicate === "champion-at");
    assert.equal(seen.value.glyph, "f", "through the apparatus the ⊤ reads SETTLED (excluded) — misrecognition");
    // the VIOLENCE is namable; the history is INTACT (the full trace still folds to ⊤).
    const mis = misrecognized(trueFiber, viewFiber);
    assert.deepEqual(mis, [{ predicate: "champion-at", object: "claimant", was: "⊤", now: "f" }]);
    assert.equal(trace.length, 3, "no row deleted — the suppressed face is still on disk");
    const refolded = being("claimant", trace);
    assert.equal(refolded.fiber.find((c) => c.predicate === "champion-at").value.glyph, "⊤",
      "without the apparatus the ⊤ folds right back — the violence was in the LOOKING");
  });

  // ============================================================================================
  // (d) WHY / WITNESS seam
  // ============================================================================================
  await ok("why() over a DIRECTLY-ASSERTED cell returns its value + witness rows, derived:false", async () => {
    await doing({ root: world, agent: "scribe", subject: "gate", predicate: "open", object: "north", t: "t1" });
    const ans = await why({ root: world, subject: "gate", predicate: "open", object: "north" });
    assert.equal(ans.value.glyph, "t");
    assert.equal(ans.derived, false, "asserted, not derived by a closure");
    assert.equal(ans.witness.pos.length, 1, "one positive witness row");
    assert.ok(ans.witness.pos[0].startsWith("row:"), "the witness is a row-id");
    assert.equal(ans.witness.neg.length, 0);
  });

  await ok("why() over a DERIVED cell returns which closure rules fired (replayable derivation)", () => {
    // a fiber with a rule that derives `dangerous` from `armed`; why explains the derivation.
    const rule = { rule: "threat", when: [{ predicate: "armed" }], then: { predicate: "dangerous", object: "yes" } };
    const trace = [
      { e: "guard", a: "closure-rule", v: rule, t: "r1" },
      { e: "guard", a: "armed", v: "spear", t: "t1" },
    ];
    // close so `dangerous` is present, then settle the closed fiber and ask why.
    const closed = closeFiber("guard", trace, [rule]);
    const thing = being("guard", closed.rows, { witness: true });
    const ans = whyFiber(thing, closed.rows, "dangerous", "yes");
    assert.equal(ans.present, true);
    assert.equal(ans.value.glyph, "t");
    assert.equal(ans.derived, true, "produced by a closure rule");
    assert.equal(ans.rules.length, 1);
    assert.equal(ans.rules[0].rule, "threat", "the rule that fired — replayable derivation");
  });

  await ok("why() over a ⊤ cell shows BOTH witness faces (the contradiction's two sides, traceable)", async () => {
    await declareConverse(world, "permit", "valid", "void", "c1");
    await doing({ root: world, subject: "permit", predicate: "valid", object: "permit", t: "t1" });
    await doing({ root: world, subject: "permit", predicate: "void", object: "permit", t: "t2" });
    const ans = await why({ root: world, subject: "permit", predicate: "valid", object: "permit" });
    assert.equal(ans.value.glyph, "⊤", "told both faces → ⊤");
    assert.equal(ans.witness.pos.length, 1, "the asserting witness");
    assert.equal(ans.witness.neg.length, 1, "the denying (converse) witness — both sides traceable");
  });

  // ============================================================================================
  // (e) FRACTAL RE-ENTRY
  // ============================================================================================
  await ok("RE-ENTRY projects a settled actor's fiber into a nested internal thing-structure", () => {
    const actor = being("noble", [
      { e: "noble", a: "drive:hunger", v: "high", t: "t1" },
      { e: "noble", a: "role:lord", v: "manor", t: "t2" },
      { e: "noble", a: "kind", v: "actor", t: "t3" },
    ]);
    const inner = reenter(actor, { facets: { "drive:": "appetite", "role:": "persona" }, fallback: "ego" });
    // each cell projects onto an internal sub-body <actor>/<facet>.
    assert.ok(inner.subjects.includes("noble/appetite"), "the appetite sub-body");
    assert.ok(inner.subjects.includes("noble/persona"), "the persona sub-body");
    assert.ok(inner.subjects.includes("noble/ego"), "unmapped cells go to the fallback facet");
    // it is a LOGICAL projection — an in-memory handle, NOT a disk root.
    assert.equal(inner.root, "noble#inner", "a logical handle, not a path");
    // the internal field settles with the SAME engine (being folds the projected rows).
    const appetite = being("noble/appetite", inner.rows.filter((r) => r.e === "noble/appetite"));
    assert.ok(appetite.fiber.some((c) => c.predicate === "drive:hunger" && c.object === "high"),
      "the appetite sub-body carries the actor's hunger at a finer grain");
  });

  await ok("re-entry carries the actor's CLOSURE RULES onto the sub-bodies (same engine, finer grain)", () => {
    const rule = { rule: "urge", when: [{ predicate: "drive:hunger" }], then: { predicate: "seek", object: "food" } };
    const actor = being("beast", [
      { e: "beast", a: "closure-rule", v: rule, t: "r1" },
      { e: "beast", a: "drive:hunger", v: "high", t: "t1" },
    ]);
    const inner = reenter(actor, { facets: { "drive:": "appetite" }, fallback: "appetite" });
    const sub = "beast/appetite";
    const subRows = inner.rows.filter((r) => r.e === sub);
    const fiber = being(sub, subRows).fiber;
    const rules = fiber.filter((c) => c.predicate === "closure-rule").map((c) => c.object);
    const closed = closeFiber(sub, subRows, rules);
    assert.ok(closed.fired.some((f) => f.predicate === "seek"), "the internal field closes under the actor's own rules");
  });

  await ok("re-entry COMPOSES (fractal depth): a sub-body can re-enter again", () => {
    assert.equal(depthOf("noble"), 0, "the actor sits at grain 0");
    assert.equal(depthOf("noble/appetite"), 1, "a facet is grain 1");
    assert.equal(depthOf("noble/appetite/urge"), 2, "a facet of a facet is grain 2");
    // a sub-body re-enters: its fiber projects to a finer grain still.
    const sub = being("noble/appetite", [{ e: "noble/appetite", a: "drive:hunger", v: "high", t: "t1" }]);
    const deeper = reenter(sub, { fallback: "urge" });
    assert.ok(deeper.subjects.includes("noble/appetite/urge"), "the fractal goes deeper by the world's facet supply");
  });

  await ok("INVERSE re-entry: many actors re-enter as ONE composite body (a scale UP)", () => {
    const a = being("alice", [{ e: "alice", a: "supports", v: "reform", t: "t1" }]);
    const b = being("bob", [{ e: "bob", a: "supports", v: "reform", t: "t1" }]);
    const comp = composite([a, b], { subject: "the-faction" });
    const fiber = being("the-faction", comp.rows).fiber;
    assert.ok(fiber.some((c) => c.predicate === "kind" && c.object === "composite"));
    assert.ok(fiber.some((c) => c.predicate === "member" && c.object === "alice"));
    assert.ok(fiber.some((c) => c.predicate === "member" && c.object === "bob"));
    // each member's cell rides up tagged by its source — the field of actors read as one body.
    assert.ok(fiber.some((c) => c.predicate === "member:supports"), "members' positions aggregate onto the composite");
  });

  console.log(`\n${pass} higher-structure checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
