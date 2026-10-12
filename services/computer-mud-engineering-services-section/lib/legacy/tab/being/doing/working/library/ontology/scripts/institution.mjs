// institution — VOLUNTARY-CONSTRAINT: an INSTITUTION is a thing whose fiber IS a closure-rule-system, and
// a body ENTERS it by committing — a predication in the BODY'S OWN fiber (the witness side) that subjects
// the body to the institution's rules. `institution/` is the keystone of working's ontology: it shows the
// SAME machinery models a game-world AND a social structure — only the rule-system differs. A dungeon's
// physics and a guild's obligations are both closure-rule-systems; entering either is the same move.
//
// THE INSITUTION. A thing with `kind=institution` carries a `constraint` rule-system — closure rules that
// describe what FOLLOWS from membership (an obligation, a sanction, a recognition). These are ordinary
// closure-rule cells (rules-as-DATA) the WORKING engine reads off the institution's fiber. The institution
// is not special-cased: it is a refinement of thing whose fiber happens to be mostly rules.
//
// VOLUNTARY ENTRY (witness-side). A body is not constrained by an institution it has not joined. Entry is
// the body's OWN move: it appends `member-of=<institution>` to ITS OWN fiber — a predication on the
// witness side, the body declaring its commitment. (This mirrors compose's polarities: the commitment is
// the body's mark, not something the institution writes onto the body.) Only a body that holds
// `member-of=<inst>` has the institution's constraint rules applied to it. Leaving is the converse face
// (`not-member-of`) — the rules then no longer fire (their antecedent `member-of` is denied), append-only,
// the history of having been a member kept whole. A body that never joins is untouched (no-op), so a world
// of institutions a body ignores costs nothing.
//
// APPLYING THE CONSTRAINT. `applyTo(institution, body)` produces the rule-system to close OVER the body:
// the institution's constraint rules, each guarded by an extra antecedent clause `member-of=<inst>`, so
// they fire ONLY when the body holds the membership commitment. The caller closes the body's fiber under
// this guarded system with the existing WORKING engine — no new engine, no hard-coded social physics.
//
//   institutionDefinition(spec) -> { id, cells }      kind=institution + its constraint rules as cells
//   constraintRules(fiber)                            read the institution's rule-system off its fiber
//   enterRow(body, institution, t) / leaveConverse()  the body's voluntary commitment / its converse
//   isMember(bodyFiber, institution)                  does the body hold the membership commitment?
//   applyTo(instFiber, institution) -> rules[]        membership-guarded rules to close over a body
//
// Pure: reads fibers, emits cells/rules. The actual disk close is the caller's (closing/compose).

import { holds } from "#value";
import { readRules } from "#working";

export const KIND = "institution";
export const MEMBER_OF = "member-of";          // the body's commitment cell (witness-side)
export const NOT_MEMBER_OF = "not-member-of";  // its converse face (leaving)
export const CONSTRAINT = "constraint";        // an institution's rule-system marker predicate (informational)

// institutionDefinition — an institution SPEC -> EAVT cells. A spec is { id, name?, constraints:[{rule,
// when?,then}] }: each constraint is an ordinary closure rule (rules-as-DATA). Emits kind/naming and the
// constraint rules as closure-rule cells filed on the institution. The rules are stored UNGUARDED here
// (their pure form); `applyTo` adds the membership guard when closing them over a particular body, so the
// institution's own fiber states its constraints plainly and the guard is a property of APPLICATION.
export function institutionDefinition(spec) {
  if (!spec || typeof spec !== "object" || typeof spec.id !== "string") {
    throw new TypeError("institutionDefinition: spec needs an id");
  }
  const id = spec.id;
  const cells = [];
  cells.push({ subject: id, predicate: "kind", object: KIND });
  if (spec.name != null) cells.push({ subject: id, predicate: "naming", object: spec.name });
  for (const rule of spec.constraints ?? []) {
    cells.push({ subject: id, predicate: "closure-rule", object: rule });
  }
  return { id, cells };
}

// constraintRules — read the institution's rule-system off its settled fiber. This is just `readRules`
// (the WORKING engine's rule reader) — an institution's constraints ARE closure rules, no new format.
export const constraintRules = (instFiber) => readRules(instFiber);

// isInstitution — does the fiber declare kind=institution?
export const isInstitution = (fiber) =>
  fiber.some((c) => c.predicate === "kind" && c.object === KIND && holds(c.value));

// enterRow — the body's VOLUNTARY commitment: a row on the BODY's OWN log declaring membership. This is
// the witness-side move — the body subjects itself; the institution does not reach in. Append-only.
export const enterRow = (body, institution, t) => ({ e: body, a: MEMBER_OF, v: institution, t });

// leaveConverse — the converse DECLARATION that makes leaving honest: `member-of` has-converse
// `not-member-of`, so a body that later asserts `not-member-of=<inst>` folds the membership cell off
// (the constraint rules' `member-of` antecedent no longer holds). Returned as a {predicate, to} shape
// for declareConverse / the DSL `converse` field. History of membership stays whole.
export const leaveConverse = () => ({ predicate: MEMBER_OF, to: NOT_MEMBER_OF });

// isMember — does the body's settled fiber HOLD the commitment to this institution? (A `not-member-of`
// face folds the cell to f/⊥ and this reads false — the body left.) The membership cell is functional in
// a world that registers `member-of` so the latest commitment/withdrawal wins.
export function isMember(bodyFiber, institution) {
  const cell = bodyFiber.find((c) => c.predicate === MEMBER_OF && c.object === institution);
  return !!cell && holds(cell.value);
}

// applyTo — the membership-GUARDED rule-system to close OVER a body. Take the institution's constraint
// rules and prepend `{ predicate: "member-of", object: <institution> }` to each rule's `when`, so a rule
// fires on the body ONLY if the body holds the commitment. This is what makes the constraint VOLUNTARY:
// a non-member's close under this system is a no-op (the guard never holds). The caller runs these
// through the existing WORKING engine over the body's fiber. Deterministic (institution rule order).
export function applyTo(instFiber, institution) {
  const guard = { predicate: MEMBER_OF, object: institution };
  return constraintRules(instFiber).map((r) => ({
    rule: `${institution}:${r.rule}`,
    when: [guard, ...r.when],
    then: r.then,
  }));
}
