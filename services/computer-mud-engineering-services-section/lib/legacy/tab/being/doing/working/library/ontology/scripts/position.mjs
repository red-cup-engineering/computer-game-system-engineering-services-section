// position — a SOCIAL KIND read: a POSITION is a body's PREDICATION PROFILE within a field, projected
// onto the four-corner bilattice. `position/` is part of working's ontology because a position is the
// SETTLEMENT of the field's competitive closure as it lands on one body: it reads the body's recognition
// cells (and their `excluded-` converse faces) and reports the bilattice value of each position channel.
//
// THE FOUR CORNERS ARE THE FOUR STATES OF A POSITION (this is the Lakota cosmogony / Belnap mapping the
// ontology rests on — {⊥,t,f,⊤} are the four superior Wakȟáŋ, here read as the four conditions of standing
// in a field):
//   t  (1,0) — RECOGNIZED   : the field recognizes the body in this position (positive evidence only)
//   f  (0,1) — EXCLUDED     : the field excludes the body (the `excluded-<position>` converse face)
//   ⊥  (0,0) — UNKNOWN      : neither recognized nor excluded — the position is open / not yet contested
//   ⊤  (1,1) — CONTESTED    : BOTH recognized and excluded — a struggle the field holds as a situation
//
// This does NOT introduce a new value: it READS the body's already-folded fiber. The competitive closure
// (field.competitiveRules) appends the `excluded-<position>` faces; the converse declaration ties each
// `excluded-<position>` to its `<position>` so the FOLD raises ⊤ when a body is both recognized and
// excluded. `position(body, field)` just projects those folded cells onto the field's position vocabulary.
//
//   positionConverses(positions) -> [{predicate, to}]   the converse declarations a field/body needs so the
//                                                        excluded-face folds as negative evidence
//   profile(bodyFiber, positions) -> { <position>: {pos,neg,glyph,state} }   the bilattice profile
//   recognizedIn / excludedFrom / contestedIn(profile) -> [<position>]       partitions of the profile
//
// Pure: reads a settled body fiber + the field's position vocabulary. No disk.

import { value, glyph, isTop, isBottom, isTrue, isFalse } from "#value";

// the four named states of a position, by bilattice corner.
const STATE = (v) => (isTop(v) ? "contested" : isTrue(v) ? "recognized" : isFalse(v) ? "excluded" : "unknown");

// the converse predicate the competitive closure denies a position through: `excluded-<position>` is the
// negative face of `<position>`. A field declares (via positionConverses) that <position> has-converse
// excluded-<position>, so a body told both folds to ⊤ on the position cell.
export const excludedPredicate = (position) => `excluded-${position}`;

// positionConverses — the converse DECLARATIONS a field (and the bodies in it) need so the excluded-face
// reads as negative evidence for the position. One per position: { predicate:<position>, to:excluded-<p> }.
// A DSL `converse` field shape, or fed to declareConverse. This is what makes a both-faces position ⊤.
export function positionConverses(positions) {
  return (positions ?? []).map((p) => ({ predicate: p, to: excludedPredicate(p) }));
}

// profile — a body's bilattice profile over a field's position vocabulary. For each position predicate,
// read the body's folded cell on it (the fold already merged the `excluded-<p>` converse face as negative
// evidence, so a both-faces body reads ⊤). Returns { <position>: { pos, neg, glyph, state } }. A position
// the body has no cell on at all reads ⊥/unknown — distinct, via the closure/articulation layer, from a
// position that was OPENED but unanswered. `positions` is the field's position vocabulary.
export function profile(bodyFiber, positions) {
  if (!Array.isArray(bodyFiber)) throw new TypeError("profile: bodyFiber must be a settled fiber array");
  const out = {};
  for (const p of positions ?? []) {
    const cell = bodyFiber.find((c) => c.predicate === p);
    const v = cell ? value(cell.value.pos, cell.value.neg) : value(0, 0);
    out[p] = { pos: v.pos, neg: v.neg, glyph: glyph(v), state: STATE(v) };
  }
  return out;
}

// partitions of a profile by state — the field's standings read off one body.
export const recognizedIn = (prof) => Object.keys(prof).filter((p) => prof[p].state === "recognized");
export const excludedFrom = (prof) => Object.keys(prof).filter((p) => prof[p].state === "excluded");
export const contestedIn = (prof) => Object.keys(prof).filter((p) => prof[p].state === "contested");
export const unknownIn = (prof) => Object.keys(prof).filter((p) => prof[p].state === "unknown");

// isBottomProfile — convenience: does the body have NO standing at all in the field (every position ⊥)?
export const noStanding = (prof) => Object.values(prof).every((c) => isBottom(value(c.pos, c.neg)));
