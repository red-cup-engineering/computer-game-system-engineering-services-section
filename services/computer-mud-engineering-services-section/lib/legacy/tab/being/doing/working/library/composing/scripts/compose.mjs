// composing — ⊙ COMPOSE-AND-CLOSE: a bilateral ludic play between two bodies that settles at
// quiescence. `composing/` is working's library because composition is what the closure engine runs
// ON: take two settled fibers, FUSE them cell-by-cell via #value's truthMeet (⊙) in OPPOSITE
// polarities (Girard's two players — one asserts, one is acted-upon; the proponent's mark meets the
// opponent's cell), APPEND the settlement rows to the composite subject, then run `closeFiber` on the
// composite to a least fixed point. The result is the settled play.
//
// THE TWO POLARITIES. A composition has an active body and a passive body (proponent / opponent, the
// agent and the target). The active body's HOLDING cells are its MARKS (what it asserts onto the
// other); each mark ⊙ the passive body's matching cell yields the settlement of that channel:
//   t ⊙ t = t   both bodies affirm the channel — the interaction takes
//   f ⊙ t = f   the passive body denies — the interaction is available but FAILS
//   ⊥ ⊙ x = ⊥   the passive body is silent on the channel — no interaction (dropped)
//   ⊤ ⊙ t = ⊤   the passive body ALREADY holds the channel as contested — the situation rides through
// ⊙ does not MANUFACTURE ⊤ (truthMeet of a fresh t and f settles to f, per #value's law). A FRESH
// asserting+denying interaction is two APPENDED rows (the mark's positive face and the converse's
// negative face); the FOLD then settles that cell to ⊤ — composition's ⊤ is the knowledge-fold's, as
// the law requires. So compose-and-close appends BOTH faces of a contested channel and lets the
// composite's fold raise the ⊤, rather than meeting one in.
//
// composeFibers(active, passive, opts?) -> { settlements:[{predicate,object,value,glyph}] }
//   PURE: the ⊙ fusion of the active body's marks against the passive body's cells. No disk.
// compose({ root, active, passive, t, rules?, observer? }) -> { appended, settlements, fired, ... }
//   EFFECTFUL: settle both bodies, fuse, APPEND each determined settlement onto the PASSIVE body's
//   trace (the act lands on the one acted-upon), then CLOSE the passive body to quiescence under its
//   rule-system. The composite's ⊤ arises from the fold of the appended rows, never from ⊙.

import { truthMeet, value, neg, glyph, isDetermined, isTop } from "#value";
import { settle, rowsFor, supersede } from "#substrate";
import doing, { declareConverse } from "#doing";
import { closeFiber, readRules } from "#working";

// composeFibers — the PURE ⊙ fusion. For each HOLDING mark in the active body, find the passive
// body's cell on the same predicate and meet them (⊙). The active mark carries the active cell's
// polarity: a t mark asserts (value(1,0)); an f mark (the active body holding the converse face)
// denies (neg). A determined (non-⊥) meet is a settlement; ⊥ is silence and is dropped. Deterministic
// order: active fiber order, then passive matches. No RNG.
export function composeFibers(active, passive, opts = {}) {
  if (!active || !Array.isArray(active.fiber)) throw new TypeError("composeFibers: active must be a settled being");
  if (!passive || !Array.isArray(passive.fiber)) throw new TypeError("composeFibers: passive must be a settled being");
  // an optional channel filter: only compose on these predicates (the apparatus the play uses).
  const channels = opts.channels ? new Set(opts.channels) : null;
  const settlements = [];
  for (const mark of active.fiber) {
    if (channels && !channels.has(mark.predicate)) continue;
    // the active cell as a mark: t (pos) asserts; f (neg) denies via the truth involution.
    const m = isTop(mark.value) ? value(1, 1)
      : mark.value.pos ? value(1, 0)
        : mark.value.neg ? neg(value(1, 0))
          : null;
    if (m === null) continue; // a ⊥ mark asserts nothing
    for (const cell of passive.fiber) {
      if (cell.predicate !== mark.predicate) continue;
      if (mark.object !== undefined && cell.object !== mark.object) continue;
      const out = truthMeet(cell.value, m); // ⊙ — fiber fusion (the passive cell, met by the mark)
      if (!isDetermined(out)) continue;     // ⊥ — silence, not an interaction
      settlements.push({
        predicate: cell.predicate,
        object: cell.object,
        value: { pos: out.pos, neg: out.neg, glyph: glyph(out) },
        // BOTH-FACED: a settlement that is f because the mark denied a held t channel records BOTH
        // faces, so the composite's fold raises ⊤ (the contradiction-as-value), per the law. A plain
        // t or f (agreement, or a one-sided denial) records its single face.
        bothFaces: out.pos === 1 && mark.value.neg === 1 && cell.value.pos === 1,
      });
    }
  }
  return { settlements };
}

// compose — the EFFECTFUL compose-and-close (a bilateral ludic play). Settle the active and passive
// bodies (each through `observer`'s view if given), fuse via ⊙, APPEND each determined settlement onto
// the PASSIVE body's trace (the play lands on the one acted-upon), then run the closure engine on the
// passive body to a least fixed point. The composite's ⊤ comes from the FOLD of the appended rows.
//
// A settlement marked bothFaces appends BOTH the positive row AND a converse declaration + the
// converse face, so the passive body's fold settles that channel to ⊤ (a fresh assert+deny → ⊤ via the
// knowledge fold, never via ⊙). Returns the appended rows, the settlements, and the closure trace.
export default async function compose({ root, active, passive, t, rules, observer, channels } = {}) {
  if (!root || active == null || passive == null || t == null) {
    throw new TypeError("compose: root, active, passive, t are required");
  }
  const view = observer ? { observer } : {};
  const activeThing = await settle(root, active, view);
  const passiveThing = await settle(root, passive, view);

  const { settlements } = composeFibers(activeThing, passiveThing, { channels });

  // Append each settlement onto the PASSIVE body, attributed to the ACTIVE body (it enacted the cut).
  const appended = [];
  let seq = 0;
  const stamp = () => `${t}/compose:${String(++seq).padStart(4, "0")}`;
  for (const s of settlements) {
    if (s.bothFaces) {
      // a fresh assert+deny: declare a converse face and append both, so the FOLD raises ⊤. We mint a
      // composition-local converse predicate so we do not collide with the body's own predications.
      const denied = `denied-${s.predicate}`;
      await declareConverse(root, passive, s.predicate, denied, stamp());
      const { row: pos } = await doing({ root, agent: active, subject: passive, predicate: s.predicate, object: s.object, t: stamp() });
      const { row: negRow } = await doing({ root, agent: active, subject: passive, predicate: denied, object: s.object, t: stamp() });
      appended.push(pos, negRow);
    } else if (s.value.glyph === "f") {
      // a one-sided denial: record the converse face only (negative evidence), append-only.
      const denied = `denied-${s.predicate}`;
      await declareConverse(root, passive, s.predicate, denied, stamp());
      const { row } = await doing({ root, agent: active, subject: passive, predicate: denied, object: s.object, t: stamp() });
      appended.push(row);
    } else {
      // t or ⊤: append the positive face (a ⊤ that was ALREADY contested in the passive body stays so).
      const { row } = await doing({ root, agent: active, subject: passive, predicate: s.predicate, object: s.object, t: stamp() });
      appended.push(row);
    }
  }

  // CLOSE the passive body to quiescence under its rule-system (read off its own grown fiber unless
  // an explicit rule-system is handed in). The closure CLOSES AGAINST any ⊤ the settlements raised —
  // it never aborts on the contradiction.
  const closed = await settle(root, passive, view);
  const ruleSystem = rules ?? readRules(closed.fiber);
  let rows = await rowsFor(root, passive);
  rows = supersede(rows);
  const result = closeFiber(passive, rows, ruleSystem, {
    t: (n) => `${t}/compose-close:${String(n).padStart(4, "0")}`,
  });
  for (const f of result.fired) {
    const { row } = await doing({
      root, agent: active, subject: passive, predicate: f.predicate, object: f.object,
      t: `${t}/compose-close:${String(appended.length + 1).padStart(4, "0")}`,
    });
    appended.push(row);
  }

  return {
    appended,
    settlements,
    fired: result.fired,
    steps: result.steps,
    quiescent: result.quiescent,
    diverged: result.diverged,
  };
}
