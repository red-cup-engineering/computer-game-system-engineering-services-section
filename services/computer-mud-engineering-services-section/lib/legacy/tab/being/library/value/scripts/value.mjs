// value — the thin four-value bilattice TAB settles cells into. FOUR = {bottom, t, f, top}.
//
// A settled cell carries an evidence pair (pos, neg) in {0,1}^2 (thin / presence-only — the witness
// terms live in being's reified-attribution layer). The two bits ARE the value; the four corners are
// the bilattice FOUR:
//   (0,0) = bottom  — no evidence either way (honest ignorance)
//   (1,0) = t       — positive evidence only
//   (0,1) = f       — negative evidence only (the CONVERSE predication supplied it)
//   (1,1) = top     — BOTH asserted: a contradiction-as-a-VALUE, a situation, not a bug.
//
// This is the whole point of using a bilattice instead of a boolean: `top` lets the world hold "the
// permit both is and is not within its decision window" as a first-class state the renderer can show.
//
// The four-value ALGEBRA is no longer hand-rolled here: the knowledge-join, the truth-meet, the
// face-swap, the ⊤ test, and the evidence-aggregation union all delegate to @red-cup-engineering/metrologic/bilattice's
// charge carrier. This thin `{pos,neg}` is the projection of a charge's `value` bits with an empty
// evidence carrier (tab's evidence lives upstream, in being); each op lifts to a charge, runs math's
// lattice op, and projects the value back. Zero local lattice math.

import {
  joinKnowledge,
  meetTruth,
  negate,
  isTop as chargeIsTop,
} from "@red-cup-engineering/metrologic/bilattice/charge";

// --- charge bridge --------------------------------------------------------------------------
// A tab value is the thin projection of a math charge: its two value bits, with no evidence carried
// (tab's witness terms ride in being's fiber, not in this presence-only mark). toCharge lifts a
// {pos,neg} to a charge; fromCharge projects a charge's value back to a frozen {pos,neg}.
const toCharge = (a) => ({ value: [!!a.pos, !!a.neg], evidence: [[], []] });
const fromCharge = (c) => Object.freeze({ pos: c.value[0] ? 1 : 0, neg: c.value[1] ? 1 : 0 });

export const BOTTOM = Object.freeze({ pos: 0, neg: 0 });
export const TRUE = Object.freeze({ pos: 1, neg: 0 });
export const FALSE = Object.freeze({ pos: 0, neg: 1 });
export const TOP = Object.freeze({ pos: 1, neg: 1 });

export const value = (pos, neg) => Object.freeze({ pos: pos ? 1 : 0, neg: neg ? 1 : 0 });

// Knowledge join (the information order's lub): accumulate evidence. Monotone — evidence only ever
// grows, never retracts, as we fold more rows. ⊥ ≤_k t,f ≤_k ⊤. Delegates to math's joinKnowledge.
export const knowledgeJoin = (a, b) => fromCharge(joinKnowledge({ left: toCharge(a), right: toCharge(b) }));

// truthMeet (⊙) — the truth-order meet: fiber FUSION. Positive evidence must AGREE (both affirm →
// still t), negative evidence ACCRUES (either denies → denied). This is math's meetTruth:
//   t ⊙ t = t   (both affirm — the action succeeds)
//   f ⊙ t = f   (target denies — the action is available but FAILS)
//   ⊥ ⊙ x = ⊥   (silence composes trivially — not an available action at all)
//   ⊤ ⊙ t = ⊤   (a cell the world ALREADY holds as contested stays a situation)
// ⊙ does NOT manufacture ⊤ from a fresh disagreement (t ⊙ f = f); the ⊤ "situation" arises in the
// knowledge fold (knowledgeJoin of a cell and its converse), and ⊙ passes it through.
export const truthMeet = (a, b) => fromCharge(meetTruth({ left: toCharge(a), right: toCharge(b) }));

// neg — swap the evidence faces. A row on a CONVERSE predicate contributes negative evidence for the
// cell oriented at its positive predicate (no polarity field anywhere). math's truth involution.
export const neg = (a) => fromCharge(negate(toCharge(a)));

// aggregate — combine two witness lists (the witness-combining join). Thin evidence is the degenerate
// case: presence is a single trivial mark, and the join is union. The union is math's: lift the two
// lists into the positive face of a charge, knowledge-join (which unions the evidence carrier,
// deduped, order-preserving — the kernel's `{allOf:[w1,w2]}`), and read the carrier back.
export const aggregate = (a = [], b = []) =>
  joinKnowledge({
    left: { value: [false, false], evidence: [a, []] },
    right: { value: [false, false], evidence: [b, []] },
  }).evidence[0];

export const isBottom = (a) => a.pos === 0 && a.neg === 0;
export const isTop = (a) => chargeIsTop(toCharge(a));
export const isTrue = (a) => a.pos === 1 && a.neg === 0;
export const isFalse = (a) => a.pos === 0 && a.neg === 1;
// determined — settled to a definite face (t, f, or the contradiction ⊤); not still ⊥.
export const isDetermined = (a) => a.pos === 1 || a.neg === 1;
// holds — usable as "this predication is in force": positive evidence present (t or ⊤).
export const holds = (a) => a.pos === 1;

const GLYPH = new Map([
  ["0,0", "⊥"],
  ["1,0", "t"],
  ["0,1", "f"],
  ["1,1", "⊤"],
]);
export const glyph = (a) => GLYPH.get(`${a.pos},${a.neg}`);
