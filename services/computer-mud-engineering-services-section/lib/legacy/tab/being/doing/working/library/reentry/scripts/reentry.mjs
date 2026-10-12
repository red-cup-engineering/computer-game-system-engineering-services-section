// reentry — FRACTAL RE-ENTRY: a settled actor's fiber SEEDS a nested internal thing-structure at social
// scale. `reentry/` is part of working's ontology because the SAME thing-structure (a body + its fiber +
// its closure) applies at a DIFFERENT GRAIN: an actor settled at the individual scale can be RE-ENTERED
// as a field of internal positions (its drives, its roles, its parts) settled by the same machinery — and
// a field of actors re-enters as a single composite body. The structure is fractal: thing-within-thing,
// the closure engine running at each scale.
//
// DEFAULT: A LOGICAL PROJECTION, NOT A SEPARATE DISK ROOT. (NOTE — this is the cheaper option, chosen
// per the build plan.) Re-entry does NOT create a new on-disk world. It PROJECTS the actor's existing
// fiber at a different grain: each of the actor's cells becomes a relation between INTERNAL sub-bodies
// (named `<actor>/<facet>`), folded as an ordinary being. So a re-entry costs one in-memory projection,
// not a disk root — the nested structure is a LOGICAL view of the same fiber, re-keyed to sub-subjects.
// A world that wants a durable internal world can later promote a projection to its own root; the default
// keeps it logical.
//
// HOW IT PROJECTS. `reenter(thing, opts?)` takes a settled actor and a `facets` map (which predicates
// belong to which internal sub-body) and emits a fiber for an INTERNAL field whose subjects are
// `<actor>/<facet>`. A cell `(actor, drive:hunger, high)` under facet `appetite` becomes an internal cell
// `(<actor>/appetite, drive:hunger, high)`. The internal field carries the actor's habitus/closure rules
// re-keyed to the sub-bodies, so the SAME WORKING engine closes the internal structure. Unmapped cells
// stay on a default `<actor>/self` facet. The projection is deterministic and pure.
//
// FRACTAL DEPTH. Because a projected sub-body is itself a settled being, re-entry COMPOSES: a sub-body's
// fiber can re-enter again (a facet of a facet) to whatever grain the world declares. `depthOf` reports
// how many `/`-levels a re-entered subject carries. The structure terminates when the world stops
// supplying facets — finite by the world's choice, not by a hard cap.
//
//   reenter(thing, opts) -> { root, subjects, rows, projection }   the LOGICAL internal field (in-memory rows)
//   facetOf(predicate, facets) -> <facet>                          which internal sub-body a cell projects onto
//   composite(things, opts) -> { subject, rows }                   the INVERSE: many actors re-enter as one body
//   depthOf(subject) -> number                                     the fractal depth of a (re-entered) subject
//
// Pure: projects an in-memory fiber to in-memory rows. Touches NO disk (the whole point of the logical
// default). A caller may `being(sub, rows)` / `closeFiber` the projection to settle the internal field.

import { holds } from "#value";

export const FACET_SEP = "/"; // the grain separator: <actor>/<facet> names an internal sub-body.

// facetOf — which internal sub-body a cell projects onto. `facets` maps a predicate (or a predicate
// prefix ending in ":") to a facet name; an unmapped predicate goes to the `default` facet (default
// "self"). So a world declares "drive:* belongs to appetite, role:* to persona" and the projection
// routes each cell to its sub-body.
export function facetOf(predicate, facets = {}, fallback = "self") {
  if (facets[predicate] !== undefined) return facets[predicate];
  // prefix match: a facets key ending ":" matches any predicate under that family.
  for (const key of Object.keys(facets)) {
    if (key.endsWith(":") && predicate.startsWith(key)) return facets[key];
  }
  return fallback;
}

// reenter — PROJECT a settled actor's fiber into a nested internal thing-structure at a finer grain. The
// actor's HOLDING cells are re-keyed onto internal sub-bodies `<actor>/<facet>`; its closure rules are
// re-keyed too (so the internal field closes under the same dispositions). Returns an in-memory `rows`
// array (EAVT) for the internal field, the set of `subjects` it spans, and a `projection` map
// (sub-body -> the predicates it received). NO disk: `root` is a logical handle (`<actor>#inner`), not a
// path. The caller folds/closes these rows in memory to settle the internal structure.
//   opts.facets: { <predicate|prefix:>: <facet> }   which sub-body each cell goes to
//   opts.fallback: <facet>                           the default facet for unmapped cells (default "self")
export function reenter(thing, opts = {}) {
  if (!thing || !Array.isArray(thing.fiber) || typeof thing.entity !== "string") {
    throw new TypeError("reenter: thing must be a settled being { entity, fiber }");
  }
  const actor = thing.entity;
  const facets = opts.facets ?? {};
  const fallback = opts.fallback ?? "self";
  const root = `${actor}#inner`; // a LOGICAL handle — not a disk root (the cheap default).
  const sub = (facet) => `${actor}${FACET_SEP}${facet}`;

  const rows = [];
  const subjects = new Set();
  const projection = {};
  let seq = 0;
  const emit = (e, a, v) => {
    rows.push({ e, a, v, t: `reenter:${String(++seq).padStart(4, "0")}` });
    subjects.add(e);
  };

  for (const cell of thing.fiber) {
    if (!holds(cell.value)) continue; // project the holding cells (the actor's settled state)
    // a closure rule re-keys: a habitus/closure rule the actor carried applies to its sub-bodies too.
    if (cell.predicate === "closure-rule") {
      // file the rule on EACH facet's sub-body so the internal field closes under the same dispositions.
      for (const facet of new Set([...Object.values(facets), fallback])) {
        emit(sub(facet), "closure-rule", cell.object);
      }
      continue;
    }
    const facet = facetOf(cell.predicate, facets, fallback);
    const subject = sub(facet);
    emit(subject, cell.predicate, cell.object);
    (projection[subject] ??= []).push(cell.predicate);
  }

  return { root, subjects: [...subjects].sort(), rows, projection };
}

// composite — the INVERSE re-entry: many settled actors re-enter as ONE composite body at a COARSER
// grain. Each actor's holding cells project onto the composite subject, tagged by the actor they came
// from (the cell's object is paired with its source so the composite can tell its members apart). This is
// a field of actors read as a single body — the fractal structure going UP a scale. In-memory rows; no
// disk. `opts.subject` names the composite (default a join of the actor names).
export function composite(things, opts = {}) {
  if (!Array.isArray(things) || things.length === 0) {
    throw new TypeError("composite: things must be a non-empty array of settled beings");
  }
  const subject = opts.subject ?? things.map((t) => t.entity).sort().join("+");
  const rows = [];
  let seq = 0;
  rows.push({ e: subject, a: "kind", v: "composite", t: `composite:${String(++seq).padStart(4, "0")}` });
  for (const thing of things) {
    rows.push({ e: subject, a: "member", v: thing.entity, t: `composite:${String(++seq).padStart(4, "0")}` });
    for (const cell of thing.fiber) {
      if (!holds(cell.value) || cell.predicate === "closure-rule") continue;
      // a member's cell becomes a composite cell tagged by member: predicate stays, object pairs source.
      rows.push({
        e: subject,
        a: `member:${cell.predicate}`,
        v: { member: thing.entity, object: cell.object },
        t: `composite:${String(++seq).padStart(4, "0")}`,
      });
    }
  }
  return { subject, rows };
}

// depthOf — the FRACTAL DEPTH of a (possibly re-entered) subject: how many grain-levels it carries,
// counted by the `/` separators. The actor `noble` is depth 0; `noble/appetite` is 1; `noble/appetite/
// urge` is 2. A reader uses this to know which scale a subject sits at. Terminates by the world's facet
// supply, not a hard cap.
export function depthOf(subject) {
  if (typeof subject !== "string") throw new TypeError("depthOf: subject must be a string");
  return subject.split(FACET_SEP).length - 1;
}
