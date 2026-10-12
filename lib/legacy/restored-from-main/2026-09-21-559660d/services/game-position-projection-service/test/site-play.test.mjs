import assert from "node:assert/strict";
import test from "node:test";

import { projectSitePlay } from "../src/site-play.mjs";

test("projects explicit site observations without acquiring the sites", () => {
  const result = projectSitePlay({ focus: "ops", operations: [
    { endpoint: "ops", url: "http://ops/health", status: "witness", body: { status: "ok", scripts: ["start-work"] } },
    { endpoint: "down", url: "http://down/health", status: "obstruction", reason: "offline" },
  ] });
  assert.equal(result.focus, "ops");
  assert.equal(result.settlement.value, "stable");
  assert.equal(result.steps[0].move, "restore-operation-surface");
  assert.equal(result.workItems.length, result.steps.length);
});
