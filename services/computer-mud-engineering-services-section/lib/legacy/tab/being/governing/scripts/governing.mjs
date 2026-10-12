// governing — the GOVERNING regime: the FINITE cap over working's (scott-continuous) field. `governing/`
// is the fourth and last regime of the four-regime descent (Becoming/Doing/Working/Governing across
// aperiodic/transfinite/scott-continuous/finite). Where WORKING iterates a field to a least fixed point
// (and may sit with ⊤ cells in it indefinitely), GOVERNING is the FINITE bound on that field: it manages
// the ⊤ cells — the contradictions working produced — at a chosen RATE, and surfaces the REPRODUCTION
// REGIME (how fast). It is finite because it caps: only so many ⊤ cells are processed per pass.
//
// ⊤-PROCESSING. Working closes AGAINST ⊤ (the contradictions ride along, first-class). Governing is what
// DOES something with them, without ever erasing them — the two moves are:
//   VIEW    (library/violence) — an apparatus SUPPRESSES a ⊤ on read (symbolic violence): the observer's
//            cut drops one face so the cell looks settled. History intact; the ⊤ is recoverable.
//   ROUTE   (library/affect)   — a closure rule APPENDS an affect cell beside a ⊤ (affect-routing): the
//            contradiction is metabolized into a feeling the body can act on. The ⊤ is preserved.
// governing.mjs is the cap that drives these: it reads the field's ⊤ cells (working's `contested`),
// and processes them under a REGIME.
//
// THE REPRODUCTION REGIME — how fast ⊤ cells are managed (the descent's three lower regimes, surfaced):
//   STRICT (finite)            — process ALL ⊤ cells this pass. The contradictions are governed at once;
//                                the field reproduces its order completely each tick (a finite, total cap).
//   SCOTT-CONTINUOUS (lazy)    — process ⊤ cells up to a BUDGET per pass; the rest carry to next pass.
//                                Order reproduces incrementally, converging — the working regime's own
//                                rate, applied to governance.
//   APERIODIC (drift)          — process NO ⊤ cells (budget 0): the contradictions accumulate, the field's
//                                order does NOT reproduce on schedule — hysteresis/crisis as data. (The
//                                aperiodic seed of the descent: ungoverned ⊤ is the field out of joint.)
// `regimeBudget(regime, total)` maps a regime to how many ⊤ cells a pass processes; `govern(...)` runs
// one pass under it. The regime is a CHOICE about reproduction speed, surfaced as data — not hard-coded.
//
//   REGIMES                                          the three reproduction regimes
//   regimeBudget(regime, total, opts?) -> number     how many ⊤ cells a pass processes under a regime
//   contestedCells(fiber) -> [{predicate,object}]    the ⊤ cells the field holds (working's `contested`)
//   govern({ subject?, fiber, regime, routings?, budget? }) ->
//     { processed, deferred, affectAppends, affectRules, regime, rate }
//     ONE governing pass: read the ⊤ cells, take `budget` of them (per the regime), emit the affect
//     cells to APPEND for those (⊤-detected; the caller appends them) plus the shippable rule form, and
//     report what was deferred. The ⊤ cells are never deleted — only the rate of their routing is capped.
//
// Pure: reads a settled fiber, emits the routing rules to close. The disk close is the caller's. The ⊤
// cells are NEVER deleted — governing manages the RATE at which they are viewed/routed, never erases them.

import { isTop } from "#value";
import { affectRules, affectCells } from "../library/affect/scripts/affect.mjs";

// the three reproduction regimes (the descent's lower three, read as governance speeds).
export const REGIMES = Object.freeze(["strict", "scott-continuous", "aperiodic"]);

// regimeBudget — how many ⊤ cells one pass processes under a regime, given `total` contested cells:
//   strict          -> total      (govern them ALL — finite, total reproduction)
//   scott-continuous-> min(budget, total)  (a per-pass budget; rest carries — incremental reproduction)
//   aperiodic       -> 0          (govern NONE — order drifts, contradictions accumulate)
// `opts.budget` sets the scott-continuous per-pass cap (default 1 — one contradiction managed per tick,
// the canonical lazy rate). An unknown regime throws — the three are the whole typology.
export function regimeBudget(regime, total, opts = {}) {
  switch (regime) {
    case "strict": return total;
    case "scott-continuous": return Math.min(opts.budget ?? 1, total);
    case "aperiodic": return 0;
    default: throw new TypeError(`regimeBudget: regime must be one of ${REGIMES.join("/")}, got ${JSON.stringify(regime)}`);
  }
}

// contestedCells — the ⊤ cells a settled fiber HOLDS (the field's contradictions working left in place).
// This is working's `contested`, re-read here as governing's input: these are what a pass manages.
// Deterministic fiber order.
export function contestedCells(fiber) {
  const out = [];
  for (const c of fiber) {
    if (isTop(c.value)) out.push({ predicate: c.predicate, object: c.object });
  }
  return out;
}

// govern — ONE governing pass over a field's settled `fiber` under a `regime`. Read the ⊤ cells, take
// `budget`-many of them (per the regime), and for each processed ⊤ emit the affect-routing rule that
// APPENDS its affect (the caller closes these onto the fiber — the ⊤ stays, the affect is added). The
// rest are DEFERRED to the next pass (carried, not lost). Returns the processed/deferred split, the
// affect rules to close, the regime, and the `rate` (processed / total) — the reproduction speed as data.
//   routings: [{ on, feel, via? }]  — how each contested predicate routes to an affect (affect.affectRules)
//   A ⊤ cell with no matching routing is still counted processed (the governance reached it) but emits no
//   rule — a world can govern a ⊤ by view alone (violence) without an affect routing.
export function govern({ subject, fiber, regime = "strict", routings = [], budget } = {}) {
  if (!Array.isArray(fiber)) throw new TypeError("govern: fiber must be a settled fiber array");
  const contested = contestedCells(fiber);
  const cap = regimeBudget(regime, contested.length, { budget });
  const processed = contested.slice(0, cap);
  const deferred = contested.slice(cap);

  // for each processed ⊤, the affect routing keyed on its predicate (if the world declared one).
  const matched = [];
  for (const c of processed) {
    const routing = routings.find((r) => r.on === c.predicate);
    if (routing) matched.push(routing);
  }
  // the affect rows to APPEND: only for the PROCESSED ⊤ cells (⊤-detected by affectCells). Restrict the
  // fiber to the processed cells so a deferred ⊤ gets no affect this pass. A subject is needed to file the
  // appends on; without one (a pure read) we report no appends, only the shippable rule form.
  const processedFiber = fiber.filter((c) => processed.some((p) => p.predicate === c.predicate && p.object === c.object));
  const affectAppends = subject ? affectCells(subject, processedFiber, matched) : [];
  return {
    processed,
    deferred,
    affectAppends,
    affectRules: affectRules(matched),
    regime,
    rate: contested.length === 0 ? 1 : processed.length / contested.length,
  };
}
