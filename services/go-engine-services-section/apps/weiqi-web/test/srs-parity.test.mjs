// Browser boundary contract, NOT another copy of upstream FSRS-lite's unit
// tests. All scheduling math belongs to education-platform-service/src/srs.mjs.
// The Weiqi build projects that one module without translating its code.
// Upstream tests own constants, transitions, monotonicity and edge cases;
// this receiver test checks both artifact identity and the running API.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import * as upstream from "@red-cup-engineering/education-platform-service/srs";
import * as browser from "../public/js/srs.mjs";

const SOURCE_URL = import.meta.resolve("@red-cup-engineering/education-platform-service/srs");
const PROJECTED_URL = new URL("../public/js/srs.mjs", import.meta.url);

test("browser SRS is the exact upstream source projection, not independently maintained code", async () => {
  const [source, projected] = await Promise.all([
    readFile(new URL(SOURCE_URL), "utf8"),
    readFile(PROJECTED_URL, "utf8"),
  ]);
  // This is the only transformation in the existing build-kernel.mjs.
  assert.equal(projected, source.replace(/[ \t]+$/gm, ""),
    "public/js/srs.mjs drifted from education-platform-service; regenerate with npm run build");
});

test("browser and upstream SRS expose precisely the same API and constants", () => {
  assert.deepEqual(Object.keys(browser).sort(), Object.keys(upstream).sort());
  for (const name of ["FACTOR", "DECAY", "DEFAULT_TARGET_RETENTION", "STAGE_CUTS"]) {
    assert.deepEqual(browser[name], upstream[name], name);
  }
});

test("browser scheduler and upstream scheduler agree for grades, times and input boundaries", () => {
  for (const stability of [0, 0.4, 1, 2.5, 10, 100]) {
    for (const elapsed of [-1, 0, 1, 3, 30, 365]) {
      assert.equal(browser.recallProbability(elapsed, stability),
        upstream.recallProbability(elapsed, stability), `S=${stability}, t=${elapsed}`);
    }
    for (const target of [0.5, 0.7, 0.9]) {
      assert.equal(browser.daysUntilRetention(stability, target),
        upstream.daysUntilRetention(stability, target), `S=${stability}, R=${target}`);
    }
  }
  const cases = [
    { stability: 0, difficulty: 5 },
    { stability: 0.4, difficulty: 9, lastReviewedAt: 0 },
    { stability: 4.5, difficulty: 5, lastReviewedAt: 10 },
    { stability: 90, difficulty: 1, lastReviewedAt: 10 },
  ];
  for (const prior of cases) {
    for (const grade of [1, 2, 3, 4]) {
      for (const now of [0, 10, 11, 30, 100]) {
        const snapshot = structuredClone(prior);
        assert.deepEqual(browser.reviewCard(prior, grade, now),
          upstream.reviewCard(prior, grade, now),
          `grade=${grade}, now=${now}, prior=${JSON.stringify(prior)}`);
        assert.deepEqual(prior, snapshot, "neither projection may mutate the input card");
      }
    }
  }
  for (const instant of [-86_400_001, -1, 0, 86_399_999, 86_400_000]) {
    assert.equal(browser.epochDayOf(instant), upstream.epochDayOf(instant));
  }
});
