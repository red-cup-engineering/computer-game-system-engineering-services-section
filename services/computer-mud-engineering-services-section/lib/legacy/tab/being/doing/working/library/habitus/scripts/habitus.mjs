// habitus — the DISPOSITIONAL closure: per-body closure rules H_e ACQUIRED from the body's own
// settlement HISTORY, not authored and not global. `habitus/` is part of working's ontology because
// it PARAMETERIZES the closure engine BY THE BODY: where `field`/`institution` ship a rule-system a
// designer wrote, habitus READS a rule-system OFF the body's settled fiber that the body's own past
// settlements GENERATED. The engine reads rules off the body's OWN fiber (Phase 3 (a)), so a body
// carries its own learned dynamics — Bourdieu's habitus as "structured structures predisposed to
// function as structuring structures."
//
// THE DISTINCTION: POSITION vs DISPOSITION. A body's POSITION (position.mjs) is its CURRENT relations
// — the bilattice profile of where it stands NOW. Its DISPOSITION is what it has LEARNED to do — the
// closure rules that fire AUTOMATICALLY when a matching predicate appears, regardless of the present
// situation. Position is read off the present cells; disposition is read off the HISTORY of how cells
// settled. The same fiber carries both: the held cells (position) and the acquired habitus rules
// (disposition). habitus.mjs reads the second.
//
// ACQUISITION (history -> dispositions). A disposition is acquired when a body REPEATEDLY settled the
// same consequent in the presence of the same antecedent: a regularity in its own past. `acquire(
// history, opts?)` scans a body's settled co-occurrences — for each (antecedent-predicate ->
// consequent-predicate) pair that recurs at least `threshold` times across the body's settlements, it
// mints a habitus rule H: when the antecedent holds, fire the consequent. This is INDUCTION over the
// body's trace, NOT a designer's authored rule. The acquired rules are ordinary closure-rule cells
// (rules-as-DATA) filed on the body — so the SAME WORKING engine fires them, and SWARM can ship a
// body's acquired habitus.
//
// HYSTERESIS. Because a disposition is acquired from past settlements and then fires on its own, a body
// keeps acting on a regularity AFTER the conditions that produced it have changed — the habitus lags
// the field (Bourdieu's hysteresis). `acquire` mints the rule; once filed, it fires in every future
// close even if the body's present position no longer warrants it. The lag is not a bug: it is the
// disposition outliving its origin, surfaced as data (the rule's `since` records when it was acquired).
//
// TRANSPOSITION. A disposition acquired in one DOMAIN transposes to another: a rule learned as
// (antecedent -> consequent) on domain-tagged predicates can be RE-KEYED onto a different domain's
// predicates of the same relational shape. `transpose(rule, fromDomain, toDomain)` rewrites a habitus
// rule's predicates from one domain prefix to another — the body carries the same DISPOSITION into a
// new field. This is what makes habitus general rather than a lookup table: the structuring structure
// applies across domains.
//
//   acquire(history, opts?) -> [{rule,when,then,since,strength}]   dispositions induced from settlements
//   habitusCells(body, dispositions) -> [{subject,predicate,object}]  the acquired rules as EAVT cells
//   habitusRules(fiber) -> [rule...]                               read a body's HABITUS rules off its fiber
//   transpose(rule, fromDomain, toDomain) -> rule                  re-key a disposition across domains
//   dispositions(fiber) vs positions — disposition (learned) distinct from position (current relations)
//
// Pure: reads a body's settled history / fiber, emits cells/rules. The disk close is the caller's
// (closing/compose). Append-only: a disposition is minted once and never retracted (the habitus is
// durable); a body that re-learns the same regularity simply strengthens the existing cell.

import { holds } from "#value";
import { readRules } from "#working";

// HABITUS_MARK — the object tag that distinguishes a habitus (acquired) closure rule from an authored
// one. Both are `closure-rule` cells the WORKING engine fires; this tag lets a reader tell a body's
// LEARNED dispositions apart from the rules a designer shipped it. Stored on the rule object.
export const HABITUS_MARK = "habitus";

// the DEFAULT acquisition threshold: how many times an (antecedent -> consequent) co-occurrence must
// recur in the body's history before it crystallizes into a disposition. One co-occurrence is an
// accident; `threshold` recurrences is a regularity the body has internalized.
const DEFAULT_THRESHOLD = 2;

// settlementPairs — the (antecedent-predicate, consequent-predicate) co-occurrences in a body's
// settlement HISTORY. A "settlement" is one entry in `history`: a snapshot of which predicates the body
// held holding at a past moment (a fiber, or a {when:[pred...], then:pred} record the caller kept). For
// a fiber snapshot, every ORDERED pair of distinct holding predicates is a co-occurrence (the body
// settled them together); the caller may instead supply explicit cause/effect records. We count pairs.
function settlementPairs(history) {
  const counts = new Map(); // "ante|cons" -> { count, firstSeen }
  let idx = 0;
  for (const entry of history) {
    idx += 1;
    // an entry may be an explicit record { when:[{predicate}...]|[pred...], then:{predicate}|pred }
    // (a settlement the body kept), or a raw fiber snapshot (array of cells) we read pairs off of.
    let antePreds = [];
    let consPreds = [];
    if (Array.isArray(entry)) {
      // a fiber snapshot: holding predicates co-occurred. Each ordered distinct pair is (ante -> cons).
      const preds = [...new Set(entry.filter((c) => c.value && holds(c.value)).map((c) => c.predicate))];
      antePreds = preds;
      consPreds = preds;
    } else if (entry && typeof entry === "object") {
      const norm = (x) => (typeof x === "string" ? x : x && typeof x === "object" ? x.predicate : null);
      antePreds = (Array.isArray(entry.when) ? entry.when : [entry.when]).map(norm).filter(Boolean);
      const t = entry.then;
      consPreds = (Array.isArray(t) ? t : [t]).map(norm).filter(Boolean);
    }
    for (const a of antePreds) {
      for (const c of consPreds) {
        if (a === c) continue; // a predicate does not dispose itself
        const key = `${a}|${c}`;
        const rec = counts.get(key);
        if (rec) rec.count += 1;
        else counts.set(key, { count: 1, firstSeen: idx, ante: a, cons: c });
      }
    }
  }
  return counts;
}

// acquire — INDUCE a body's dispositions from its settlement HISTORY. For each (antecedent ->
// consequent) co-occurrence recurring at least `threshold` times, mint a habitus closure rule: when the
// antecedent predicate holds, fire the consequent predicate. The minted rule carries `since` (the
// settlement index it first appeared — the hysteresis origin) and `strength` (the recurrence count).
// Deterministic order: by predicate-pair key. `opts.threshold` overrides the default; `opts.object`
// (default the consequent's typical object, or true) sets the fired consequent's object.
//   history: [ fiberSnapshot | { when, then } ... ]   the body's past settlements
//   -> [{ rule, when:[{predicate}], then:{predicate,object}, since, strength, [HABITUS_MARK]:true }]
export function acquire(history, opts = {}) {
  if (!Array.isArray(history)) throw new TypeError("acquire: history must be an array of settlements");
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  const counts = settlementPairs(history);
  const rules = [];
  for (const [, rec] of [...counts].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (rec.count < threshold) continue; // an accident, not yet a disposition
    rules.push({
      rule: `habitus:${rec.ante}>${rec.cons}`,
      when: [{ predicate: rec.ante }],
      then: { predicate: rec.cons, object: opts.object ?? "disposed" },
      since: rec.firstSeen,
      strength: rec.count,
      [HABITUS_MARK]: true,
    });
  }
  return rules;
}

// habitusCells — a body's acquired dispositions as EAVT cells: one (body, "closure-rule", <habitus
// rule>) per disposition. These are ORDINARY closure-rule cells (rules-as-DATA) — the WORKING engine
// reads and fires them off the body's own fiber, no new machinery. Filed on the body itself: the
// disposition travels with the body (transposable, shippable).
export function habitusCells(body, dispositions) {
  if (typeof body !== "string" || !body) throw new TypeError("habitusCells: body must be a non-empty string");
  return (dispositions ?? []).map((rule) => ({ subject: body, predicate: "closure-rule", object: rule }));
}

// habitusRules — read a body's HABITUS (acquired) closure rules off its settled fiber: the closure
// rules whose object carries the HABITUS_MARK. This is `readRules` filtered to dispositions — so a
// reader can separate a body's LEARNED firing (disposition) from the authored rules it also carries.
// The engine itself fires both indiscriminately (they are all closure-rule cells); this read is for
// interpretation (why did this fire? — a disposition or a designed rule?).
export function habitusRules(fiber) {
  return readRules(fiber).filter((r) => {
    // readRules normalizes a rule to {rule,when,then}; the mark rides on the rule's `then`-adjacent
    // fields the spec preserved. Re-read the raw closure-rule cell's object for the mark.
    return r.rule && typeof r.rule === "string" && r.rule.startsWith("habitus:");
  });
}

// dispositionsOf — the body's dispositions as the raw rule objects (with `since`/`strength`/mark), read
// off the fiber's holding closure-rule cells. Distinct from `position.profile` (current relations): this
// is what the body has LEARNED to do, not where it stands. Used by the WHY seam to label a firing.
export function dispositionsOf(fiber) {
  const out = [];
  for (const c of fiber) {
    if (c.predicate !== "closure-rule" || !holds(c.value)) continue;
    const spec = c.object;
    if (spec && typeof spec === "object" && spec[HABITUS_MARK] === true) out.push(spec);
  }
  return out;
}

// transpose — RE-KEY a disposition from one DOMAIN to another. A habitus rule acquired on
// `<from>:`-prefixed predicates is rewritten onto `<to>:`-prefixed predicates of the same relational
// shape: the body carries the SAME disposition into a new field. (A predicate without the `from` prefix
// is left untouched — only the domain-tagged predicates transpose.) This is what makes habitus a
// STRUCTURING STRUCTURE rather than a lookup: the disposition applies across domains.
//   transpose({when:[{predicate:"combat:aggress"}], then:{predicate:"combat:win"}}, "combat", "trade")
//     -> when [{predicate:"trade:aggress"}], then {predicate:"trade:win"}
export function transpose(rule, fromDomain, toDomain) {
  if (!rule || typeof rule !== "object") throw new TypeError("transpose: rule must be a habitus rule object");
  if (typeof fromDomain !== "string" || typeof toDomain !== "string") {
    throw new TypeError("transpose: fromDomain and toDomain must be strings");
  }
  const re = new RegExp(`^${fromDomain}:`);
  const rekey = (p) => (typeof p === "string" ? p.replace(re, `${toDomain}:`) : p);
  const when = (rule.when ?? []).map((cl) => ({ ...cl, predicate: rekey(cl.predicate) }));
  const then = { ...rule.then, predicate: rekey(rule.then.predicate) };
  return {
    ...rule,
    rule: typeof rule.rule === "string" ? rule.rule.replace(new RegExp(fromDomain, "g"), toDomain) : rule.rule,
    when,
    then,
    transposed: { from: fromDomain, to: toDomain },
  };
}
