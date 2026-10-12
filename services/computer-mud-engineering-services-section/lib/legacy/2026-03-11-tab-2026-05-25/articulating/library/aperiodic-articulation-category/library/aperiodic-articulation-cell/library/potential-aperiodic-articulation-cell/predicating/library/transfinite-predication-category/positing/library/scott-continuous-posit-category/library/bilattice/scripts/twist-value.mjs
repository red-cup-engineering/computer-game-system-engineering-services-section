// twist-value — predication VALUES over a GENERAL residuated lattice L.
//
// The value of a predication is an element of the fiber algebra A_p = (L×L)^(E×E):
// per entity-pair, a twist-product pair (α, β) — α = positive-evidence degree ∈ L,
// β = negative-evidence degree ∈ L — over a DECLARED residuated lattice L
// (spotcomp PREDICATION-FIBER-ALGEBRA.md). The value IS this rich (α,β) pair; the
// degrees are never collapsed to a coarse label.
//
// A commutative residuated lattice L = ⟨L, ∨, ∧, ·, →, 1⟩ (residuated-lattice journal):
//   ⟨L,∨,∧⟩ bounded lattice; ⟨L,·,1⟩ commutative monoid; residuation x·y ≤ z ⇔ x ≤ y→z.
// We realize the integral Gödel chain (·=∧, idempotent) for any finite ordered carrier.

// Build a residuated lattice on a finite ascending carrier (labels[0]=⊥ … last=⊤).
export function chain(id, labels) {
  const idx = new Map(labels.map((l, i) => [l, i]));
  const at = (l) => {
    if (!idx.has(l)) throw new TypeError(`lattice ${id}: ${JSON.stringify(l)} not in carrier`);
    return idx.get(l);
  };
  return Object.freeze({
    id,
    elements: Object.freeze([...labels]),
    bot: labels[0],
    top: labels[labels.length - 1],
    leq: (a, b) => at(a) <= at(b),
    join: (a, b) => (at(a) >= at(b) ? a : b), // sup
    meet: (a, b) => (at(a) <= at(b) ? a : b), // inf
    fuse: (a, b) => (at(a) <= at(b) ? a : b), // Gödel ·  = ∧ (idempotent)
    residual: (a, b) => (at(a) <= at(b) ? labels[labels.length - 1] : b), // Gödel →
  });
}

// The two-element Boolean lattice — the default carrier when evidence is ungraded.
export const BOOLEAN = chain('boolean', ['absent', 'present']);

// A twist-product value over L: (α, β) ∈ L × L. The PREDICATION VALUE.
export function value(L, positive, negative) {
  return Object.freeze({ lattice: L.id, positive, negative });
}
export const bottom = (L) => value(L, L.bot, L.bot);

// Knowledge order: accumulate evidence componentwise. The settling (directed sup).
export function knowledgeJoin(L, a, b) {
  return value(L, L.join(a.positive, b.positive), L.join(a.negative, b.negative));
}
// Truth order: (α,β) ≤_t (α',β') iff α≤α' and β'≤β (the load-bearing order).
export function leqTruth(L, a, b) {
  return L.leq(a.positive, b.positive) && L.leq(b.negative, a.negative);
}
// Negation swaps the evidence components — this is what a CONVERSE/opposing predication
// contributes: positive evidence for p^op(o,s) is negative evidence for p(s,o).
export function neg(L, a) {
  return value(L, a.negative, a.positive);
}

// Is the cell determinate at all? (any evidence above ⊥, either sign). Used only to tell
// "settled to some degree" from "untouched ⊥" — it returns degrees, not a collapsed label.
export function determined(L, v) {
  return v.positive !== L.bot || v.negative !== L.bot;
}
// Is there positive evidence (α above ⊥)? Used to read a held predication (a name, an exit).
export function isPositive(L, v) {
  return v.positive !== L.bot;
}
