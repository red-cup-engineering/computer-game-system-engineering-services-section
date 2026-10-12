// prove-ontology — PHASE 2, the ONTOLOGY. Proves the four parts, all built on the WORKING closure
// engine, all preserving the four-corner bilattice and append-only/paraconsistent law:
//   (a) ARTICULATION / potential-cell — a row-kind that OPENS a cell; ⊥-as-opened distinguished from
//       ⊥-as-absent; surfaced in closure distance as `potential`. NOT a fifth bilattice value.
//   (b) KIN-RELATIONAL discipline — dyadic relation is primitive; monadic decomposes to relation-to-
//       relative; bare monadic cells are flagged (the located-in/contains discipline generalized).
//   (c) SOCIAL KINDS — FIELD (competitive closure: recognize-one => exclude-others, raising ⊤ on a
//       contested position), POSITION (bilattice profile recognized=t/excluded=f/unknown=⊥/both=⊤),
//       CAPITAL (typed species, conversion as closure rules).
//   (d) INSTITUTION / voluntary-constraint — a thing whose fiber IS a closure-rule-system; a body
//       enters by a witness-side commitment; the SAME engine models game-worlds and social structures.

import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import being from "#being";
import { glyph } from "#value";
import doing, { declareConverse } from "#doing";
import { settle } from "#substrate";
import closure from "#closure";
import { closeFiber, readRules } from "#working";

import { potential, openings, articulatingRow, ARTICULATING } from "#articulating";
import { relate, bareMonadic, lintKinship, isDyadicShaped } from "#kinship";
import { fieldDefinition, competitiveRules, isField, positionVocabulary, stakeOf } from "#field";
import { profile, recognizedIn, excludedFrom, contestedIn, positionConverses, excludedPredicate } from "#position";
import { capitalDefinition, conversionRules, holdings, capitalCell, SPECIES, CAPITAL_PREFIX } from "#capital";
import { institutionDefinition, applyTo, enterRow, leaveConverse, isMember, constraintRules, MEMBER_OF } from "#institution";

let pass = 0;
const ok = (name, fn) =>
  Promise.resolve()
    .then(fn)
    .then(
      () => { pass += 1; console.log(`  ok  ${name}`); },
      (e) => { console.error(`FAIL  ${name}\n      ${e.stack}`); process.exitCode = 1; },
    );

const tmp = mkdtempSync(join(tmpdir(), "tab-ontology-"));
const world = join(tmp, "w");

// a CAPITAL-aware functional test: a world that uses capital adds the capital: prefix so deposits
// supersede. We pass it to settle via opts.functional where needed.
import { FUNCTIONAL } from "#substrate";
const CAPITAL_FUNCTIONAL = new Set([...FUNCTIONAL, MEMBER_OF]);

try {
  // ============================================================================================
  // (a) ARTICULATION / POTENTIAL-CELL
  // ============================================================================================
  await ok("an articulated cell that is still ⊥ is POTENTIAL (opened), distinct from absent", () => {
    const rows = [
      { e: "x", a: ARTICULATING, v: { predicate: "brave-toward", object: "rival" }, t: "t1" },
    ];
    const thing = being("x", rows);
    const part = potential(thing);
    assert.deepEqual(part.opened, [{ predicate: "brave-toward", object: "rival" }], "the opened question");
    assert.equal(part.determined.length, 0, "not yet answered");
    // closure SURFACES it: potential:1 (a ⊥-as-opened), while a plain world has no `potential` field.
    const c = closure(thing);
    assert.equal(c.potential, 1, "closure shows one opened-but-undetermined cell");
  });

  await ok("answering an opened cell moves it from opened to determined; potential drops to 0", () => {
    const rows = [
      { e: "x", a: ARTICULATING, v: { predicate: "brave-toward", object: "rival" }, t: "t1" },
      { e: "x", a: "brave-toward", v: "rival", t: "t2" }, // the answer lands
    ];
    const part = potential(being("x", rows));
    assert.equal(part.opened.length, 0);
    assert.deepEqual(part.determined, [{ predicate: "brave-toward", object: "rival" }]);
    assert.equal(closure(being("x", rows)).potential, 0, "no longer potential — it was answered");
  });

  await ok("a determined cell never articulated is SPONTANEOUS, not potential", () => {
    const rows = [{ e: "x", a: "kind", v: "actor", t: "t1" }];
    const part = potential(being("x", rows));
    assert.deepEqual(part.spontaneous, [{ predicate: "kind", object: "actor" }]);
    // a fiber with NO articulating rows has NO `potential` field — byte-compatible with the old shape.
    assert.equal("potential" in closure(being("x", rows)), false, "no articulation → no potential field");
  });

  await ok("potential-cell is a ROW-KIND, NOT a fifth bilattice value (four corners untouched)", () => {
    // the articulated TARGET cell stays ⊥ (a real bilattice value); the articulating cell itself is an
    // ordinary t cell. No new glyph anywhere.
    const rows = [{ e: "x", a: ARTICULATING, v: { predicate: "p", object: "q" }, t: "t1" }];
    const fib = being("x", rows).fiber;
    const art = fib.find((c) => c.predicate === ARTICULATING);
    assert.equal(glyph(art.value), "t", "the articulation fact itself is a plain t cell");
    // the four glyphs are still exactly ⊥/t/f/⊤ — articulating introduced none.
    assert.ok(["⊥", "t", "f", "⊤"].includes(glyph(art.value)));
  });

  // ============================================================================================
  // (b) KIN-RELATIONAL DISCIPLINE
  // ============================================================================================
  await ok("relate decomposes an apparently-monadic property into a relation-to-relative", () => {
    assert.deepEqual(relate("brave", "rival"), { predicate: "brave-toward", object: "rival" });
    assert.deepEqual(relate("loyal", "lord"), { predicate: "loyal-to", object: "lord" });
    // an already-dyadic predicate is left kin: the relative just becomes the object.
    assert.deepEqual(relate("located-in", "tavern"), { predicate: "located-in", object: "tavern" });
    assert.deepEqual(relate("afraid", "dark", { suffix: "of" }), { predicate: "afraid-of", object: "dark" });
  });

  await ok("the located-in/contains dyadic discipline GENERALIZES: relational predicates are kin", () => {
    assert.equal(isDyadicShaped("located-in"), true);
    assert.equal(isDyadicShaped("contains"), true);
    assert.equal(isDyadicShaped("brave-toward"), true, "decomposed predicates are kin");
    assert.equal(isDyadicShaped("need:hunger"), true, "parameterized families name their relatum");
    assert.equal(isDyadicShaped("brave"), false, "a bare monadic predicate is NOT kin");
  });

  await ok("bare monadic cells are FLAGGED at the thing level; structural/kin cells are exempt", () => {
    const fib = being("x", [
      { e: "x", a: "brave", v: "self", t: "t1" },         // bare monadic — VIOLATION
      { e: "x", a: "brave-toward", v: "rival", t: "t2" }, // kin — ok
      { e: "x", a: "kind", v: "actor", t: "t3" },         // structural — exempt
      { e: "x", a: "located-in", v: "tavern", t: "t4" },  // relational — kin
    ]).fiber;
    const bare = bareMonadic(fib);
    assert.deepEqual(bare, [{ predicate: "brave", object: "self" }], "only the bare monadic cell");
    const issues = lintKinship("x", fib);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].code, "bare-monadic");
  });

  // ============================================================================================
  // (c) SOCIAL KINDS: FIELD, POSITION, CAPITAL
  // ============================================================================================
  await ok("a FIELD is an allOf-refinement of thing: kind=field, a vocabulary, a stake", () => {
    const { cells } = fieldDefinition({ id: "arena", name: "Arena", stake: "champion", positions: ["champion-at"], contenders: ["a", "b"] });
    const fib = being("arena", cells.map((c, i) => (c.converse
      ? { e: c.predicate, a: "has-converse", v: c.object, t: `c${i}` }
      : { e: c.subject, a: c.predicate, v: c.object, t: `t${i}` }))).fiber;
    assert.equal(isField(fib), true);
    assert.deepEqual(positionVocabulary(fib), ["champion-at"]);
    assert.equal(stakeOf(fib), "champion");
    // the contender positions are OPENED (potential-cells) before recognition — the field's seeds.
    const opened = openings(fib);
    assert.ok(opened.some((o) => o.predicate === "champion-at" && o.object === "a"));
  });

  await ok("FIELD competitive closure: recognize-one => exclude-others (rules-as-DATA)", () => {
    const rules = competitiveRules({ positions: ["champion-at"], contenders: ["a", "b"] });
    const r = closeFiber("arena", [{ e: "arena", a: "champion-at", v: "a", t: "t1" }], rules);
    assert.equal(r.quiescent, true);
    assert.ok(r.fired.some((f) => f.predicate === "excluded-champion-at" && f.object === "b"), "recognizing a excludes b");
  });

  await ok("recognizing BOTH contenders raises ⊤ on the scarce position — the struggle as a situation", () => {
    const rules = competitiveRules({ positions: ["champion-at"], contenders: ["a", "b"] });
    const trace = [
      { e: "champion-at", a: "has-converse", v: "excluded-champion-at", t: "c0" },
      { e: "arena", a: "champion-at", v: "a", t: "t1" },
      { e: "arena", a: "champion-at", v: "b", t: "t2" },
    ];
    const r = closeFiber("arena", trace, rules);
    assert.equal(r.quiescent, true, "closes AGAINST ⊤ — no abort, no explosion");
    assert.equal(r.diverged, false);
    const b = r.fiber.find((c) => c.predicate === "champion-at" && c.object === "b");
    const a = r.fiber.find((c) => c.predicate === "champion-at" && c.object === "a");
    assert.equal(glyph(b.value), "⊤", "b is recognized AND excluded → ⊤ (contested position)");
    assert.equal(glyph(a.value), "⊤", "a likewise — mutual exclusion is the struggle");
  });

  await ok("POSITION reads a body's profile onto the four corners: recognized=t/excluded=f/unknown=⊥/both=⊤", () => {
    const positions = ["champion-at", "challenger-at", "outsider-at"];
    // body holds: recognized at champion (t), excluded at challenger (f via converse), nothing at outsider (⊥),
    // both at a fourth via the closure (we add it explicitly here as ⊤).
    const trace = [
      { e: "champion-at", a: "has-converse", v: excludedPredicate("champion-at"), t: "c1" },
      { e: "challenger-at", a: "has-converse", v: excludedPredicate("challenger-at"), t: "c2" },
      { e: "body", a: "champion-at", v: "body", t: "t1" },                                  // recognized → t
      { e: "body", a: excludedPredicate("challenger-at"), v: "body", t: "t2" },             // excluded → f
      // outsider-at: no cell → ⊥
    ];
    const fib = being("body", trace).fiber;
    const prof = profile(fib, positions);
    assert.equal(prof["champion-at"].state, "recognized");
    assert.equal(prof["challenger-at"].state, "excluded");
    assert.equal(prof["outsider-at"].state, "unknown");
    assert.deepEqual(recognizedIn(prof), ["champion-at"]);
    assert.deepEqual(excludedFrom(prof), ["challenger-at"]);
  });

  await ok("a body recognized AND excluded at one position reads CONTESTED (⊤) in its profile", () => {
    const trace = [
      { e: "champion-at", a: "has-converse", v: excludedPredicate("champion-at"), t: "c1" },
      { e: "body", a: "champion-at", v: "body", t: "t1" },
      { e: "body", a: excludedPredicate("champion-at"), v: "body", t: "t2" },
    ];
    const prof = profile(being("body", trace).fiber, ["champion-at"]);
    assert.equal(prof["champion-at"].state, "contested");
    assert.equal(prof["champion-at"].glyph, "⊤");
    assert.deepEqual(contestedIn(prof), ["champion-at"]);
  });

  await ok("CAPITAL: typed species cells; conversion as closure rules (rules-as-DATA)", () => {
    assert.deepEqual(SPECIES, ["economic", "cultural", "social", "symbolic"]);
    const c = capitalCell("noble", "economic", 100);
    assert.equal(c.predicate, `${CAPITAL_PREFIX}economic`);
    // a conversion fires in the closure engine: holding economic ⇒ holding cultural ⇒ holding symbolic.
    const rules = conversionRules([
      { from: "economic", to: "cultural", yields: "refined" },
      { from: "cultural", to: "symbolic", yields: "prestige" },
    ]);
    const r = closeFiber("noble", [{ e: "noble", a: `${CAPITAL_PREFIX}economic`, v: 100, t: "t1" }], rules);
    assert.equal(r.quiescent, true);
    const h = holdings(r.fiber);
    assert.equal(h.economic, 100, "kept the economic holding");
    assert.equal(h.cultural, "refined", "economic converted to cultural");
    assert.equal(h.symbolic, "prestige", "cultural converted on to symbolic (symbolic = misrecognition of the rest)");
  });

  await ok("conversionRules rejects a non-species; the four are the whole typology", () => {
    assert.throws(() => conversionRules([{ from: "economic", to: "political" }]), /species/);
    assert.throws(() => capitalCell("x", "moral", 1), /species/);
  });

  // ============================================================================================
  // (d) INSTITUTION / VOLUNTARY-CONSTRAINT
  // ============================================================================================
  await ok("an INSTITUTION is a thing whose fiber IS a closure-rule-system (read via readRules)", () => {
    const { cells } = institutionDefinition({
      id: "guild", name: "Guild",
      constraints: [{ rule: "dues", when: [{ predicate: "earned", object: "wage" }], then: { predicate: "owes", object: "dues" } }],
    });
    const fib = being("guild", cells.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `t${i}` }))).fiber;
    const rules = constraintRules(fib);
    assert.equal(rules.length, 1);
    assert.equal(rules[0].then.predicate, "owes");
    // an institution's rule-system is just readRules — the SAME reader a game-world's physics uses.
    assert.deepEqual(rules, readRules(fib));
  });

  await ok("entry is VOLUNTARY and WITNESS-SIDE: only a member has the constraint applied", async () => {
    // build the institution on disk.
    const { cells } = institutionDefinition({
      id: "guild2",
      constraints: [{ rule: "dues", when: [{ predicate: "earned", object: "wage" }], then: { predicate: "owes", object: "dues" } }],
    });
    let seq = 0;
    for (const c of cells) await doing({ root: world, subject: c.subject, predicate: c.predicate, object: c.object, t: `inst:${++seq}` });

    // a NON-member who earned a wage: applying the guarded rules fires NOTHING (the membership guard fails).
    const inst = await settle(world, "guild2");
    const guarded = applyTo(inst.fiber, "guild2");
    const nonMemberTrace = [{ e: "alice", a: "earned", v: "wage", t: "t1" }];
    const r0 = closeFiber("alice", nonMemberTrace, guarded);
    assert.ok(!r0.fiber.some((c) => c.predicate === "owes"), "a non-member owes nothing — voluntary");

    // alice JOINS: a predication in HER OWN fiber (the witness side). Now the constraint applies.
    const memberTrace = [
      enterRow("alice", "guild2", "t0"),              // her own commitment cell
      { e: "alice", a: "earned", v: "wage", t: "t1" },
    ];
    assert.equal(isMember(being("alice", memberTrace).fiber, "guild2"), true);
    const r1 = closeFiber("alice", memberTrace, guarded);
    assert.ok(r1.fiber.some((c) => c.predicate === "owes" && c.object === "dues"), "a member owes dues once committed");
  });

  await ok("the SAME machinery models game-world AND social structure — only the rule-system differs", () => {
    // a DUNGEON institution (game-world physics) and a GUILD institution (social structure): both are
    // institutionDefinition with different constraints, both close with the SAME engine + applyTo guard.
    const dungeon = institutionDefinition({
      id: "dungeon",
      constraints: [{ rule: "trap", when: [{ predicate: "stepped-on", object: "plate" }], then: { predicate: "triggered", object: "dart" } }],
    });
    const guild = institutionDefinition({
      id: "order",
      constraints: [{ rule: "vow", when: [{ predicate: "swore", object: "oath" }], then: { predicate: "bound-to", object: "order" } }],
    });
    const dFib = being("dungeon", dungeon.cells.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `d${i}` }))).fiber;
    const gFib = being("order", guild.cells.map((c, i) => ({ e: c.subject, a: c.predicate, v: c.object, t: `g${i}` }))).fiber;

    const inDungeon = closeFiber("pawn", [enterRow("pawn", "dungeon", "t0"), { e: "pawn", a: "stepped-on", v: "plate", t: "t1" }], applyTo(dFib, "dungeon"));
    const inOrder = closeFiber("knight", [enterRow("knight", "order", "t0"), { e: "knight", a: "swore", v: "oath", t: "t1" }], applyTo(gFib, "order"));
    assert.ok(inDungeon.fiber.some((c) => c.predicate === "triggered"), "dungeon physics fired");
    assert.ok(inOrder.fiber.some((c) => c.predicate === "bound-to"), "social obligation fired — same engine");
  });

  await ok("leaving is the CONVERSE face; membership history stays whole (append-only)", () => {
    const conv = leaveConverse();
    assert.deepEqual(conv, { predicate: MEMBER_OF, to: "not-member-of" });
    // a body that committed then declared not-member-of folds the membership cell off → no longer a member,
    // but the commitment row is still in the trace (history whole).
    const trace = [
      { e: MEMBER_OF, a: "has-converse", v: "not-member-of", t: "c0" },
      enterRow("ex", "guild2", "t1"),
      { e: "ex", a: "not-member-of", v: "guild2", t: "t2" }, // the converse face → membership cell ⊤/off
    ];
    const fib = being("ex", trace).fiber;
    const cell = fib.find((c) => c.predicate === MEMBER_OF && c.object === "guild2");
    // both faces asserted → ⊤ (committed AND withdrawn): a contested membership, held as a situation,
    // NOT a deletion. The history of having joined is intact.
    assert.equal(glyph(cell.value), "⊤", "join + leave is a contested membership ⊤, not an erasure");
  });

  console.log(`\n${pass} ontology checks passed.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
