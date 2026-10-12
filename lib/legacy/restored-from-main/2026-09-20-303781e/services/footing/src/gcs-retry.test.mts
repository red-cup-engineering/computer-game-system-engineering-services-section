import { test } from "node:test";
import assert from "node:assert/strict";
import { withGcsRetry } from "./gcs-retry.mjs";

test("withGcsRetry: retries a 5xx up to maxAttempts, then returns the final response", async () => {
  let calls = 0;
  const flaky = async () => {
    calls++;
    return new Response(null, { status: 503 });
  };
  const retries: number[] = [];
  const wrapped = withGcsRetry(flaky, {
    maxAttempts: 3,
    sleep: async () => {},
    onRetry: (info) => retries.push(info.attempt),
    onExhausted: () => {},
  });
  const res = await wrapped("http://x.test/");
  assert.equal(res.status, 503);
  assert.equal(calls, 3);
  assert.deepEqual(retries, [1, 2]);
});

test("withGcsRetry: a 412 passes straight through on the first attempt, never retried", async () => {
  let calls = 0;
  const wrapped = withGcsRetry(async () => {
    calls++;
    return new Response(null, { status: 412 });
  }, { sleep: async () => {} });
  const res = await wrapped("http://x.test/");
  assert.equal(res.status, 412);
  assert.equal(calls, 1);
});

test("withGcsRetry: a thrown network error retries, then rethrows once exhausted", async () => {
  let calls = 0;
  const wrapped = withGcsRetry(async () => {
    calls++;
    throw new Error("fetch failed");
  }, { maxAttempts: 2, sleep: async () => {}, onRetry: () => {}, onExhausted: () => {} });
  await assert.rejects(() => wrapped("http://x.test/"), /fetch failed/);
  assert.equal(calls, 2);
});
