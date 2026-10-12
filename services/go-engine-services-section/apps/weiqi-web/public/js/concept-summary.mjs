// The concept summary of one game: which glossary concepts each side
// exercised, how often, and which the game never touched -- read straight
// off the engine's semantic events (its rules readouts), attributed to the
// side that moved. This is the rules half of a player's readout signature
// (Whole-Board Reading as a Gluing Problem, and Lineages as Signatures, §3);
// the engine-readout half waits on the review pipeline. Pure: no DOM, and
// no rules of its own.

/** Where a concept can be trained on this site: the tsumego-foundations set that targets it, or null. */
export const CONCEPT_TRAINING = Object.freeze({
  atari: "capture",
  capture: "capture",
  eye: "life-and-death",
  "life-and-death": "life-and-death",
  pass: "endgame",
  ko: null,
  connection: null,
});

/**
 * Count each term's events per color over a study's frames (buildStudyReplay).
 * `engine` supplies the term vocabulary (TERM_PATH) and the color constants.
 */
export function summarizeConcepts(study, engine) {
  const terms = Object.keys(engine.TERM_PATH);
  const counts = { [engine.BLACK]: Object.fromEntries(terms.map((t) => [t, 0])), [engine.WHITE]: Object.fromEntries(terms.map((t) => [t, 0])) };
  for (const frame of study.frames) {
    if (frame.mover === null) continue;
    for (const event of frame.events) {
      if (!(event.term in counts[frame.mover])) continue;
      counts[frame.mover][event.term] += 1;
    }
  }
  const seen = terms.filter((term) => counts[engine.BLACK][term] + counts[engine.WHITE][term] > 0);
  const unseen = terms.filter((term) => !seen.includes(term));
  return Object.freeze({ terms, counts, seen, unseen, moves: study.version });
}

/** What to read and train next: every concept the game never touched, with its glossary term and training set. */
export function recommendNext(summary) {
  return summary.unseen.map((term) => Object.freeze({
    term,
    read: `glossary.html#${encodeURIComponent(term)}`,
    train: CONCEPT_TRAINING[term] ?? null,
  }));
}

/** One line per concept seen, for a text log or a screen reader. */
export function describeConceptSummary(summary, engine, labels = { [engine.BLACK]: "Black", [engine.WHITE]: "White" }) {
  const lines = summary.seen.map((term) => `${term.replaceAll("-", " ")}: ${labels[engine.BLACK]} ${summary.counts[engine.BLACK][term]}, ${labels[engine.WHITE]} ${summary.counts[engine.WHITE][term]}`);
  if (summary.unseen.length > 0) lines.push(`not in this game: ${summary.unseen.map((t) => t.replaceAll("-", " ")).join(", ")}`);
  return lines;
}
