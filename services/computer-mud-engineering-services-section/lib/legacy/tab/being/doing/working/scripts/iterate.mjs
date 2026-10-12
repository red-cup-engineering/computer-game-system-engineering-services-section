// iterate — the ONE iterate-to-quiescence operator the WORKING regime runs. The four-regime descent
// names a SCOTT-CONTINUOUS floor: a monotone step applied until the state stops moving (a fixed
// point). Both the closure-rule engine (closing.mjs) and the world tick (ticking.mjs) are instances
// of this single operator — repeat a step until a QUIESCENCE PREDICATE holds, bounding the run so an
// APERIODIC (non-terminating) step surfaces as interpretable DIVERGENCE, never a hang or a crash.
//
// This generalizes what `#closure` measures and what ticking hard-codes: `#closure`'s `closed`
// (distance === 0) is the canonical quiescence predicate for a fiber; ticking's "advance until the
// world settles" is the same loop with a world-state step. iterate factors the LOOP out so the only
// thing a caller supplies is its `step` and its `quiescent?` test.
//
// iterate(initial, step, opts?) -> { state, steps, quiescent, diverged, history? }
//   step(state, i) -> { state, progress }   — one monotone advance. `progress` false ⇒ no change this
//       round (a fixed point reached); the loop stops. `progress` true ⇒ keep going.
//   opts.quiescent(state) -> boolean  — an EXPLICIT quiescence test (default: stop when !progress).
//   opts.max (default 4096)           — the ceiling. Hitting it ⇒ diverged:true (aperiodic surfaced),
//                                        NOT thrown. The default converges to finite/scott-continuous
//                                        quiescence; divergence is reported, never crashes.
//   opts.history (default false)      — collect each round's state (for replay / interpretation).
//
// PURE with respect to `step`: iterate adds no state of its own beyond the counter and the ceiling.
// A `step` that is a monotone map on a finite lattice is GUARANTEED to reach its least fixed point
// (Knaster-Tarski) within the ceiling; a non-monotone or infinite-codomain step may diverge, and
// that divergence is RETURNED as data (diverged:true), the scott-continuous reading of aperiodicity.

const DEFAULT_MAX = 4096;

export default function iterate(initial, step, opts = {}) {
  if (typeof step !== "function") throw new TypeError("iterate: step must be a function");
  const max = opts.max ?? DEFAULT_MAX;
  const quiescent = typeof opts.quiescent === "function" ? opts.quiescent : null;
  const keepHistory = opts.history === true;

  let state = initial;
  let steps = 0;
  const history = keepHistory ? [state] : null;

  while (steps < max) {
    // an explicit quiescence predicate (e.g. #closure's `closed`) wins: if the state already
    // satisfies it, we are at the fixed point before stepping.
    if (quiescent && quiescent(state)) {
      return { state, steps, quiescent: true, diverged: false, ...(keepHistory ? { history } : {}) };
    }
    const out = step(state, steps);
    steps += 1;
    state = out.state;
    if (keepHistory) history.push(state);
    if (!out.progress) {
      // no advance this round — a fixed point. (If a quiescence predicate is set, re-check it; the
      // step may have stalled SHORT of it, which is still a fixed point of `step`, reported quiescent.)
      return { state, steps, quiescent: true, diverged: false, ...(keepHistory ? { history } : {}) };
    }
  }

  // ceiling hit: the step kept making progress past the bound — interpretable APERIODIC divergence.
  return { state, steps, quiescent: false, diverged: true, ...(keepHistory ? { history } : {}) };
}
