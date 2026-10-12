// render-replay-page.test — the domain-neutral core's own contract: self-containment (zero
// external references, parsed and asserted, not eyeballed), a size ceiling befitting "the fleet's
// shareable content artifact — deterministic, tiny, honest by construction" (vision §5d), and
// byte-identical determinism for the same (adapter, bundle) pair. Exercised against BOTH real
// adapters over REAL played fixtures — this file is not allowed to invent its own toy adapter to
// dodge the real ones.

import { test } from "node:test";
import assert from "node:assert/strict";
import { renderReplayPage } from "../src/render-replay-page.mjs";
import ruinfoldAdapter from "../adapters/ruinfold.mjs";
import crucibleAdapter from "../adapters/crucible.mjs";
import { loadFixture, findExternalReferences } from "./helpers.mjs";

// A generous ceiling for "tiny, shareable" — the real fixtures below land two orders of magnitude
// under this; the number exists to catch a real regression (an accidentally embedded asset, a
// runaway table), not to be brushed up against in normal operation.
const MAX_BYTES = 300_000;
const MIN_BYTES = 2_000; // catches an accidentally-empty/near-empty render

const CASES = [
  { adapter: ruinfoldAdapter, bundle: () => loadFixture("ruinfold", "2026-08-19-daily.json") },
  { adapter: ruinfoldAdapter, bundle: () => loadFixture("ruinfold", "2026-07-04-deeper.json") },
  { adapter: crucibleAdapter, bundle: () => loadFixture("crucible", "2026-08-19-certified.json") },
  { adapter: crucibleAdapter, bundle: () => loadFixture("crucible", "2026-08-19-naive.json") },
];

for (const { adapter, bundle } of CASES) {
  test(`${adapter.id}: rendered page references zero external URLs`, async () => {
    const html = renderReplayPage(adapter, await bundle());
    assert.deepEqual(findExternalReferences(html), []);
  });

  test(`${adapter.id}: rendered page is a well-formed, non-empty, tiny HTML document`, async () => {
    const html = renderReplayPage(adapter, await bundle());
    const bytes = Buffer.byteLength(html, "utf8");
    assert.ok(bytes >= MIN_BYTES, `expected >= ${MIN_BYTES} bytes, got ${bytes}`);
    assert.ok(bytes <= MAX_BYTES, `expected <= ${MAX_BYTES} bytes, got ${bytes}`);
    assert.match(html, /^<!doctype html>/i);
    assert.match(html, /<\/html>\s*$/i);
    assert.match(html, /<title>[^<]+<\/title>/);
  });

  test(`${adapter.id}: renderReplayPage(adapter, bundle) is deterministic — byte-identical across calls`, async () => {
    const bundleValue = await bundle();
    const first = renderReplayPage(adapter, bundleValue);
    const second = renderReplayPage(adapter, bundleValue);
    assert.equal(first, second);
    // And again from an independently-loaded (deep-cloned via JSON) copy of the same fixture, to
    // prove determinism is a property of the VALUES, not of object identity/caching.
    const third = renderReplayPage(adapter, await bundle());
    assert.equal(first, third);
  });
}

test("renderReplayPage throws a clear TypeError for a malformed adapter", () => {
  assert.throws(() => renderReplayPage({}, {}), TypeError);
  assert.throws(() => renderReplayPage({ id: "x", verify: () => ({}), project: () => ({}) }, {}), TypeError);
});

test("two different real replay bundles render to different pages (not a constant template)", async () => {
  const a = renderReplayPage(ruinfoldAdapter, await loadFixture("ruinfold", "2026-08-19-daily.json"));
  const b = renderReplayPage(ruinfoldAdapter, await loadFixture("ruinfold", "2026-07-04-deeper.json"));
  assert.notEqual(a, b);
});
