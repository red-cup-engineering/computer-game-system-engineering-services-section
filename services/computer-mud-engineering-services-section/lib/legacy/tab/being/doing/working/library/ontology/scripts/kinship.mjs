// kinship — the KIN-RELATIONAL discipline: the DYADIC relation is the primitive predicate shape.
// `kinship/` is part of working's ontology because the discipline is what makes a fiber WELL-FORMED for
// the closure engine to work on: a predication is a relation BETWEEN two relatives, never a bare property
// of one body in isolation. A thing is not `brave`; a thing is `brave-in-relation-to` some other. There
// is no standing-alone property — there is only standing-in-relation.
//
// THE PRIMITIVE. The substrate already files some predicates dyadically (located-in/contains/exit-to are
// dual-filed at both anchors — a relation read from either side). This module GENERALIZES that discipline
// to ALL predicates: an apparently-MONADIC property `brave` decomposes into a relation `brave-toward`
// carrying its relative as the object. The object position, which a flat attribute leaves as a bare value
// (`trait = brave`), is RE-READ as the second relatum (`brave-toward = rival`). Kinship is the claim that
// the object position was always a relative — monadic predication is a degenerate reading that drops it.
//
// DECOMPOSITION. `relate(predicate, relative)` rewrites a monadic predicate into its dyadic form:
//   brave            -> { predicate: "brave-toward", object: relative }
// The convention: a monadic predicate P becomes `P-<suffix>` (default suffix from a small table, else
// "-toward") with the relative in the object. A predicate already carrying a relative-object (it has a
// dyadic suffix, or it is one of the substrate's relational predicates) is left as-is — it is already kin.
//
// ENFORCEMENT. `bareMonadic(fiber, opts?)` returns the cells that VIOLATE the discipline: a HOLDING cell
// whose predicate is monadic (not dyadic-shaped, not relational, not structural) AND whose object is not a
// relative (it is a bare value, or it is the subject itself). Structural predicates (kind, naming, the
// closure-rule/articulating machinery) are exempt — they are not predications-about-a-body that the
// discipline governs. `lintKinship(fiber)` packages this as DSL-style issues. The discipline is enforced
// at the PREDICATE-CATEGORY / thing level: a thing's fiber should carry no bare monadic cells.
//
// This does NOT mutate history. Decomposition is a rewrite a designer (or a closure rule's `then`) applies
// when AUTHORING the cell; the lint catches bare cells that slipped through. Nothing here touches disk.

import { holds } from "#value";

// STRUCTURAL predicates: machinery, not predications-about-a-body. The discipline does not govern them —
// `kind`/`naming`/`describing` classify and name; the closure/articulation predicates are the engine's own
// row-kinds; `has-converse` declares an orientation. These may stand "monadic" without a relative.
export const STRUCTURAL = new Set([
  "kind", "naming", "describing", "biome", "region", "mover",
  "closure-rule", "articulating", "has-converse", "intends", "perceives",
  "requires", "yields", "provides",
]);

// The substrate's already-dyadic relational predicates (dual-filed at both anchors): these ARE kin — the
// object is the other relatum. Kept in sync with #substrate's RELATIONAL by intent (re-declared here so
// kinship needs no disk import; the overlap is the located-in/contains/exit-to discipline this generalizes).
export const RELATIONAL = new Set(["located-in", "contains", "exit-to"]);

// dyadic SUFFIXES: a predicate ending in one of these already names its relative in the object — it is
// kin-shaped. This is how a decomposed `brave-toward` is recognized as already-dyadic and left alone.
export const DYADIC_SUFFIXES = ["-toward", "-of", "-with", "-to", "-from", "-against", "-in", "-for", "-over", "-under"];

// a small table of natural decompositions for common monadic properties; anything not listed falls back
// to the generic "-toward" relator. (A designer may pass an explicit suffix to `relate`.)
const RELATOR = new Map([
  ["brave", "toward"], ["loyal", "to"], ["hostile", "toward"], ["kind", null], // kind is structural; excluded
  ["afraid", "of"], ["proud", "of"], ["ashamed", "before"], ["indebted", "to"],
  ["allied", "with"], ["rival", "to"], ["trusted", "by"], ["bound", "to"],
]);

// isDyadicShaped — does this predicate already name a relative in its object? True if it is one of the
// substrate's relational predicates, OR it ends in a dyadic suffix, OR it carries an explicit family
// colon (need:hunger etc. — a parameterized family whose object is the level, not a bare standalone
// property the discipline must relate). Such predicates are already kin (or structural families).
export function isDyadicShaped(predicate) {
  if (RELATIONAL.has(predicate)) return true;
  if (predicate.includes(":")) return true; // parameterized family (need:/skill:/opinion-of: etc.)
  return DYADIC_SUFFIXES.some((s) => predicate.endsWith(s));
}

// relate — DECOMPOSE a monadic predicate into its dyadic (kin) form, binding the RELATIVE in the object.
// `brave` toward `rival` -> { predicate: "brave-toward", object: "rival" }. If the predicate is already
// dyadic-shaped it is returned unchanged with the given relative as object (it already names its relatum).
// An explicit `suffix` overrides the table; otherwise the table, else the generic "toward".
export function relate(predicate, relative, opts = {}) {
  if (typeof predicate !== "string" || predicate.length === 0) {
    throw new TypeError("relate: predicate must be a non-empty string");
  }
  if (relative == null) throw new TypeError("relate: a relative (the second relatum) is required");
  if (isDyadicShaped(predicate)) return { predicate, object: relative };
  const suffix = opts.suffix ?? RELATOR.get(predicate) ?? "toward";
  return { predicate: `${predicate}-${suffix}`, object: relative };
}

// bareMonadic — the cells VIOLATING the discipline. A violation is a HOLDING cell that is:
//   - not STRUCTURAL (machinery is exempt),
//   - not dyadic-shaped (no relative named in its predicate), and
//   - whose object is a bare value rather than a relative — operationally: the cell stands as a property
//     of the subject with no second relatum. We flag any non-structural, non-dyadic holding cell; the
//     remedy is to `relate` it (give it a relative) when authoring.
// Returns [{ predicate, object }]. `opts.structural` extends the exempt set; `opts.dyadic` extends the
// recognized dyadic predicates (a world may declare its own already-kin predicates).
export function bareMonadic(fiber, opts = {}) {
  if (!Array.isArray(fiber)) throw new TypeError("bareMonadic: fiber must be an array");
  const structural = opts.structural ? new Set([...STRUCTURAL, ...opts.structural]) : STRUCTURAL;
  const dyadic = opts.dyadic ? new Set(opts.dyadic) : null;
  const out = [];
  for (const c of fiber) {
    if (!c.value || !holds(c.value)) continue;        // only holding cells are predications in force
    if (structural.has(c.predicate)) continue;        // machinery — exempt
    if (dyadic && dyadic.has(c.predicate)) continue;  // world-declared kin
    if (isDyadicShaped(c.predicate)) continue;        // already names its relative
    out.push({ predicate: c.predicate, object: c.object });
  }
  return out;
}

// lintKinship — the discipline as DSL-style issues (the same { severity, code, message, where } shape
// library/dsl/lint emits). A bare monadic cell is an error: the thing carries a property with no relative.
// `where` is the entity. Never throws on a well-formed fiber.
export function lintKinship(entity, fiber, opts = {}) {
  const issues = [];
  for (const c of bareMonadic(fiber, opts)) {
    issues.push({
      severity: "error",
      code: "bare-monadic",
      message: `"${entity}" carries bare monadic cell (${c.predicate} = ${JSON.stringify(c.object)}); a predication must relate to a relative (use kinship.relate to decompose)`,
      where: entity,
    });
  }
  return issues;
}
