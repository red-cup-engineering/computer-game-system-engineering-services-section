import { test } from "node:test";
import assert from "node:assert/strict";
import * as kernel from "../public/js/kernel/index.mjs";
import { buildStudyReplay } from "../public/js/study-replay.mjs";
import { CONCEPT_TRAINING, describeConceptSummary, recommendNext, summarizeConcepts } from "../public/js/concept-summary.mjs";

function sessionAfter(moves) {
  let session = kernel.createWeiqiGameSession({ size: 9, ruleset: "chinese" });
  for (const move of moves) {
    const admitted = kernel.admitWeiqiGameCommand(session, session.version, move === "pass" ? { kind: "pass" } : { kind: "play", move });
    assert.equal(admitted.ok, true, move);
    if (admitted.ok) session = admitted.session;
  }
  return session;
}

test("the summary attributes each engine event's concept to the side that moved", () => {
  // Black surrounds and captures White D4: atari-given by Black, capture by Black.
  const study = buildStudyReplay(sessionAfter(["E4", "D4", "D3", "A1", "C4", "A2", "D5"]));
  const summary = summarizeConcepts(study, kernel);
  assert.ok(summary.counts[kernel.BLACK].atari >= 1);
  assert.equal(summary.counts[kernel.BLACK].capture, 1);
  assert.equal(summary.counts[kernel.WHITE].capture, 0);
  assert.ok(summary.seen.includes("capture"));
  assert.ok(summary.unseen.includes("ko"));
  assert.equal(summary.moves, 7);
});

test("every unseen concept gets a glossary link and, where one exists, a training set", () => {
  const summary = summarizeConcepts(buildStudyReplay(sessionAfter(["E5"])), kernel);
  const next = recommendNext(summary);
  assert.equal(next.length, summary.unseen.length);
  for (const item of next) {
    assert.match(item.read, /^glossary\.html#/);
    assert.equal(item.train, CONCEPT_TRAINING[item.term] ?? null);
  }
  assert.equal(next.find((item) => item.term === "capture")?.train, "capture");
  assert.equal(next.find((item) => item.term === "ko")?.train, null);
});

test("the text form names counts per side and what never happened", () => {
  const summary = summarizeConcepts(buildStudyReplay(sessionAfter(["E4", "D4", "D3", "A1", "C4", "A2", "D5"])), kernel);
  const lines = describeConceptSummary(summary, kernel, { [kernel.BLACK]: "Black (you)", [kernel.WHITE]: "White (Watchful)" });
  assert.ok(lines.some((line) => /^capture: Black \(you\) 1, White \(Watchful\) 0$/.test(line)));
  assert.match(lines.at(-1) ?? "", /^not in this game: /);
});
