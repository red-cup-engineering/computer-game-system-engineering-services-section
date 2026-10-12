import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { buildBrowserKernel } from "@red-cup-engineering/weiqi-engine/build-browser";

const CHECKED_IN_KERNEL = fileURLToPath(new URL("../public/js/kernel/", import.meta.url));

/**
 * The browser kernel is an output of the upstream weiqi-engine builder,
 * never its own source of rules. Use that very builder as the expected
 * value, not a second implementation of its header/whitespace transform.
 * A standalone `npm test` must catch drift even without running `npm run
 * build` first; the release gate already builds before testing.
 */
test("every checked-in browser kernel module matches the upstream builder byte-for-byte", async () => {
  const projected = await mkdtemp(join(tmpdir(), "weiqi-browser-projection-parity-"));
  try {
    const result = await buildBrowserKernel(projected);
    const modules = (await readdir(projected)).filter((file) => file.endsWith(".mjs")).sort();
    const checkedIn = (await readdir(CHECKED_IN_KERNEL))
      .filter((file) => file.endsWith(".mjs")).sort();

    assert.equal(result.moduleCount, modules.length, "upstream builder did not emit all of its modules");
    assert.deepEqual(checkedIn, modules, "checked-in browser kernel has missing or unexpected modules");
    for (const file of modules) {
      const [expected, actual] = await Promise.all([
        readFile(join(projected, file)),
        readFile(join(CHECKED_IN_KERNEL, file)),
      ]);
      assert.deepEqual(actual, expected,
        `${file} drifted from @red-cup-engineering/weiqi-engine; regenerate with npm run build`);
    }
  } finally {
    await rm(projected, { recursive: true, force: true });
  }
});
