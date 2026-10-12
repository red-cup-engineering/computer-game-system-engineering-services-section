import assert from "node:assert/strict";
import test from "node:test";

import { activeWorkerVersion } from "../scripts/worker-deployments.mjs";

test("Cloudflare's oldest-first deployment list selects the newest fully-active Worker", () => {
  assert.equal(activeWorkerVersion([
    { created_on: "2026-09-10T00:00:00.000Z", versions: [{ version_id: "old", percentage: 100 }] },
    { created_on: "2026-09-10T01:00:00.000Z", versions: [{ version_id: "new", percentage: 100 }] },
  ]), "new");
});

test("Cloudflare deployment selection refuses missing or non-active data", () => {
  assert.throws(() => activeWorkerVersion([]), /active Worker version/u);
  assert.throws(() => activeWorkerVersion([{ created_on: "not-a-date", versions: [{ version_id: "bad", percentage: 100 }] }]), /active Worker version/u);
});
