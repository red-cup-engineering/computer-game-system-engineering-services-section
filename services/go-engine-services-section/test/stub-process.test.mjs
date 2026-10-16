import assert from "node:assert/strict";
import { test } from "node:test";
import { createAnalysisSession } from "../src/go-engine.mjs";
import { withStubSession } from "./helpers/stub-session.mjs";

test("stub process fixture rejects unknown protocols before spawning", async () => {
  await assert.rejects(
    withStubSession("invalid", createAnalysisSession, async () => {}),
    /Unsupported stub protocol/,
  );
});

test("stub process fixture reaps the child even if a protocol assertion fails", async () => {
  let responded = false;
  await assert.rejects(
    withStubSession("analysis", createAnalysisSession, async (session) => {
      const reply = await session.query({ id: "fixture-cleanup" });
      assert.equal(reply.id, "fixture-cleanup");
      responded = true;
      throw new Error("simulated test assertion failure");
    }),
    /simulated test assertion failure/,
  );
  assert.equal(responded, true, "the failure must happen after an actual protocol exchange");
});
