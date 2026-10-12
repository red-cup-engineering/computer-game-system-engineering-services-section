// affect — AFFECT-ROUTING: a structural ⊤ ROUTED into an affective cell, by APPENDING, never deleting.
// `governing/library/affect/` is the other half of ⊤-processing governance (beside violence's view):
// where the violence apparatus SUPPRESSES a ⊤ on read, affect-routing METABOLIZES it on write — it
// reads a structural contradiction (a body recognized AND excluded, committed AND withdrawn) and
// APPENDS an affective cell naming what that contradiction FEELS like to the body (shame, defiance,
// ambivalence). The ⊤ is NOT removed; the affect is a SECOND fact about the same situation, derived by
// a closure rule the WORKING engine fires. The contradiction stays; the feeling is added.
//
// LAW (FORK RESOLUTION): affect-routing is a closure rule that APPENDS, never deletes. We do NOT repair
// the ⊤ — `then` asserts an `affect:<kind>` cell, it never asserts the converse of a contested
// predicate. The structural ⊤ rides on intact in the fiber; the affective cell sits beside it. So the
// body both HOLDS the contradiction (the structural situation) and FEELS it (the affective routing) —
// two cells, one situation. This is how governing caps working's field: the ⊤ is not erased, it is
// processed into something the body can act on (an affect a respond/decide can read).
//
// ROUTING AS RULES-AS-DATA, APPLIED BY ⊤-DETECTION. An affect routing is `{ on:<contested-predicate>,
// feel:<affect-kind> }`: when the body holds `<contested-predicate>` as ⊤, append `affect:<feel>`. The
// routing's shippable form is a closure rule (`affectRules`) — rules-as-DATA SWARM can carry. But the
// WORKING engine's generic antecedent test is `holds` (pos===1), which is TRUE for BOTH t and ⊤ and so
// cannot by itself fire ONLY on a contradiction. The `excluded-<on>` converse face FOLDS INTO the `<on>`
// cell's negative face (that is what raises the ⊤), so there is no standalone `excluded-` cell for a
// two-clause guard to read either. Therefore affect-routing is APPLIED BY ⊤-DETECTION: `affectCells`
// reads which `<on>` cells are actually ⊤ (via isTop) and emits the affect rows to append. governing.mjs
// drives this (it caps the rate). The rule form (`affectRules`) carries the routing as data; the ⊤-aware
// application is governing's. Either way the consequent only ever APPENDS `affect:<feel>` — never the
// converse of `<on>`, so the ⊤ is preserved.
//
//   affectRules(routings) -> [{rule,when,then}]          ⊤-routings -> closure rules (the shippable data form)
//   affectCells(subject, fiber, routings) -> [cells]     the affect rows to APPEND for the fiber's actual ⊤ cells
//   contestedAffects(fiber) -> [{kind, on}]              the affect cells a routing produced
//   route(fiber, routings) -> [{on, feel, present}]      which routings' ⊤-condition currently holds
//
// Pure: emits rules / cells / reads a fiber. The disk append is the caller's (governing/closing).
// Append-only throughout — the ⊤ the affect sits beside is never touched.

import { isTop, holds } from "#value";

export const AFFECT_PREFIX = "affect:"; // (body, "affect:<kind>", <on-predicate>) — the routed feeling

// the converse face a contested position/membership predicate carries. A ⊤ on `<p>` means the body
// holds BOTH `<p>` and its excluded/converse face; routing keys on both so it fires only on the ⊤.
const excludedFace = (predicate) => `excluded-${predicate}`;

// affectRules — ⊤-ROUTINGS to closure rules (rules-as-DATA). A routing `{ on, feel, via? }` fires when
// the body holds `<on>` AS ⊤. We express "⊤ on <on>" as the antecedent {both <on> and its negative
// face hold}: the default negative face is `excluded-<on>` (the field/position converse), overridable
// via `routing.via`. The consequent appends `affect:<feel>` carrying `<on>` as its object (so the
// affect points back at what produced it). NEVER asserts the converse of `<on>` — the ⊤ is preserved.
//   route { on:"champion-at", feel:"defiance" } -> when [champion-at, excluded-champion-at] then affect:defiance
export function affectRules(routings) {
  const rules = [];
  for (const r of routings ?? []) {
    if (typeof r.on !== "string" || typeof r.feel !== "string") {
      throw new TypeError(`affectRules: each routing needs string { on, feel }; got ${JSON.stringify(r)}`);
    }
    const negFace = r.via ?? excludedFace(r.on);
    rules.push({
      rule: `affect:${r.on}>${r.feel}`,
      // BOTH faces must hold — i.e. the cell is ⊤. (holds(⊤) is true, so each clause is satisfied only
      // when its predicate's positive face is present; the two together require both faces = ⊤.)
      when: [{ predicate: r.on }, { predicate: negFace }],
      then: { predicate: `${AFFECT_PREFIX}${r.feel}`, object: r.on },
    });
  }
  return rules;
}

// affectCells — the ⊤-AWARE application: the affect rows to APPEND for a fiber's ACTUAL contradictions.
// For each routing whose `<on>` cell is genuinely ⊤ (isTop — not a plain t), emit one
// (subject, "affect:<feel>", <on>) cell. This is what governing appends to route a structural ⊤ into a
// feeling — detecting the ⊤ directly (the generic closure engine cannot, since holds(⊤)===holds(t)).
// Deterministic (routing order). NEVER emits the converse of `<on>` — the ⊤ stays intact.
export function affectCells(subject, fiber, routings) {
  if (typeof subject !== "string" || !subject) throw new TypeError("affectCells: subject must be a non-empty string");
  const out = [];
  for (const r of routings ?? []) {
    const cell = fiber.find((c) => c.predicate === r.on);
    if (cell && isTop(cell.value)) {
      out.push({ subject, predicate: `${AFFECT_PREFIX}${r.feel}`, object: r.on });
    }
  }
  return out;
}

// contestedAffects — the affect cells a routed fiber HOLDS: every holding `affect:<kind>` cell,
// normalized to { kind, on }. These are what the routing PRODUCED — the feelings the body now carries
// beside its structural contradictions. A respond/decide reads these to act on the affect.
export function contestedAffects(fiber) {
  const out = [];
  for (const c of fiber) {
    if (!c.predicate.startsWith(AFFECT_PREFIX) || !holds(c.value)) continue;
    out.push({ kind: c.predicate.slice(AFFECT_PREFIX.length), on: c.object });
  }
  return out;
}

// route — which routings' ⊤-CONDITION currently holds on the fiber (before/independent of firing). For
// each routing, true iff the `<on>` cell is actually ⊤ in the fiber. A reader uses this to see what the
// body WILL feel once closed, and to confirm a routing only triggers on a genuine contradiction (not a
// plain t). The structural ⊤ it reports is left untouched.
export function route(fiber, routings) {
  return (routings ?? []).map((r) => {
    const cell = fiber.find((c) => c.predicate === r.on);
    return { on: r.on, feel: r.feel, present: !!cell && isTop(cell.value) };
  });
}
