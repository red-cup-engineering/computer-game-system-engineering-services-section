// Pure, DOM-free deck/queue logic for the tsumego trainer (tsumego-app.mjs,
// task item 1). Factored out from the DOM glue for the same reason
// ladder-progress.mjs, stone-variance.mjs, touch-gesture.mjs, and
// concept-tiers.mjs are: this is where the actual decisions live, and it's
// unit-testable without a browser.
//
// SRS scheduling itself (reviewCard, recallProbability, daysUntilRetention)
// is srs.mjs, vendored from lantern-service -- this module only decides
// *which* problems are due, given card states that module produces; it
// never reimplements the forgetting curve itself.

import { daysUntilRetention, DEFAULT_TARGET_RETENTION } from "./srs.mjs";

/** Epoch day (an integer day count, UTC) for a JS Date -- srs.mjs's "now" unit. Exported so the DOM glue and this module always agree on what "today" means. */
export function epochDay(date = new Date()) {
  return Math.floor(date.getTime() / 86400000);
}

/** Whether `cardState` (srs.mjs's CardState, or undefined for a never-reviewed problem) is due at `today`. A card with no state at all is always due -- it's new. */
export function isDue(cardState, today, targetRetention = DEFAULT_TARGET_RETENTION) {
  if (!cardState || cardState.lastReviewedAt === undefined) return true;
  const dueAt = cardState.lastReviewedAt + daysUntilRetention(cardState.stability, targetRetention);
  return today >= dueAt;
}

/** How many whole days overdue `cardState` is at `today` -- used only to order an already-due queue (most-overdue first), never to decide due-ness itself (isDue owns that). Negative/zero for a card that isn't due yet or is new. */
function overdueBy(cardState, today, targetRetention = DEFAULT_TARGET_RETENTION) {
  if (!cardState || cardState.lastReviewedAt === undefined) return Infinity; // new cards sort first
  const dueAt = cardState.lastReviewedAt + daysUntilRetention(cardState.stability, targetRetention);
  return today - dueAt;
}

/** Problems matching a category/band filter (either "all" or a real declared value). */
export function filterProblems(problems, { category = "all", band = "all" } = {}) {
  return problems.filter((p) => (category === "all" || p.category === category) && (band === "all" || p.band === band));
}

/**
 * The actual training queue: `problems` filtered by category/band, then
 * (if `dueOnly`) restricted to problems that are due per `srsStates`
 * (a Map or plain object of problem id -> CardState), ordered new-first
 * then most-overdue-first. When `dueOnly` is false, returns the filtered
 * set in its original order (a "browse everything" mode).
 */
export function buildQueue(problems, srsStates, { category = "all", band = "all", dueOnly = true, today = epochDay() } = {}) {
  const filtered = filterProblems(problems, { category, band });
  const stateFor = (id) => (srsStates instanceof Map ? srsStates.get(id) : srsStates[id]);

  if (!dueOnly) return filtered;

  return filtered
    .filter((p) => isDue(stateFor(p.id), today))
    .slice()
    .sort((a, b) => {
      const oa = overdueBy(stateFor(a.id), today);
      const ob = overdueBy(stateFor(b.id), today);
      if (oa === ob) return 0; // both new (Infinity), or equally overdue -- avoid NaN from Infinity - Infinity
      return ob - oa; // most-overdue (largest) first
    });
}
