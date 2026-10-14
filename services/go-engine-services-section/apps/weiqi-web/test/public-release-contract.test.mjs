import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createWeiqiPublicRelease,
  publicWeiqiOrigins,
  receivedWeiqiRelease,
  WEIQI_ORIGIN,
  WEIQI_PUBLIC_PROBES,
} from "../scripts/public-release-contract.mjs";

const ROOT = new URL("../", import.meta.url);
const artifacts = new Map([
  ["index.html", "home"], ["play.html", "play"], ["review.html", "study"],
  ["js/kernel/index.mjs", "engine"], ["js/review-app.mjs", "review"],
  ["manifest.webmanifest", "manifest"], ["sw.js", "worker"],
]);
const source = {
  artifacts, repository: "https://example.test/owner/source",
  revision: "known-source-commit", baselineVersion: "provider-baseline",
};

function release(wrangler, origin = WEIQI_ORIGIN) {
  return createWeiqiPublicRelease({ ...source, wrangler, origin });
}

// These tests qualify the contract only. No synthetic input is a production receipt.
test("the actual Worker config selects the player origin and all distinct static receivers", async () => {
  const wrangler = JSON.parse(await readFile(new URL("wrangler.jsonc", ROOT), "utf8"));
  const origins = publicWeiqiOrigins(wrangler);
  assert.equal(origins[0], WEIQI_ORIGIN);
  assert.deepEqual(new Set(origins).size, wrangler.routes.length);
  assert.deepEqual(origins.map((origin) => new URL(origin).host).sort(),
    wrangler.routes.map((route) => route.pattern).sort());
  const releases = origins.map((origin) => release(wrangler, origin));
  assert.ok(releases.every((candidate) => candidate.channel.stateClass === "edge-static"));
  assert.ok(releases.every((candidate) => candidate.target.receiver === `worker:${wrangler.name}`));
  assert.ok(releases.every((candidate) => candidate.artifact.manifest.artifactCount === artifacts.size));
  assert.ok(releases.every((candidate) => candidate.channel.probes === WEIQI_PUBLIC_PROBES));
  assert.equal(new Set(releases.map((candidate) => candidate.digest)).size, origins.length);
});

test("bad routes, shadow routes and stateful Workers are refused before publishing", async () => {
  const wrangler = JSON.parse(await readFile(new URL("wrangler.jsonc", ROOT), "utf8"));
  const [first, ...rest] = wrangler.routes;
  assert.throws(() => publicWeiqiOrigins({ ...wrangler, routes: rest }), /requested Weiqi player origin/);
  assert.throws(() => publicWeiqiOrigins({ ...wrangler, routes: [...wrangler.routes, first] }), /duplicate/);
  assert.throws(() => publicWeiqiOrigins({ ...wrangler, routes: [{ pattern: "*.561.group", custom_domain: true }] }), /non-wildcard/);
  assert.throws(() => publicWeiqiOrigins({ ...wrangler, routes: [{ ...first, custom_domain: false }] }), /custom domains/);
  assert.throws(() => publicWeiqiOrigins({ ...wrangler, durable_objects: {} }), /static-assets Worker/);
  assert.throws(() => release(wrangler, "https://unowned.561.group/"), /not a configured Worker receiver/);
});

test("a release observation must witness the exact public bytes, not a locally issued active receipt", async () => {
  const wrangler = JSON.parse(await readFile(new URL("wrangler.jsonc", ROOT), "utf8"));
  const candidate = release(wrangler);
  const probes = candidate.channel.probes.map((expected) => ({
    id: expected.id,
    status: expected.expectedStatus,
    contentType: expected.contentType,
    digest: candidate.artifact.manifest.artifacts.find((a) => a.path === expected.artifactPath).digest,
  }));
  const observation = {
    kind: "public-release-observation", independent: true,
    releaseDigest: candidate.digest, origin: candidate.channel.canonicalOrigin, probes,
  };
  // A pure contract example is NOT a claim that these responses were fetched.
  assert.equal(receivedWeiqiRelease(candidate, observation), true);
  for (const change of [
    { kind: "public-release-observation-refusal" },
    { independent: false },
    { releaseDigest: "other-release" },
    { origin: "https://other.561.group/" },
    { probes: probes.slice(1) },
    { probes: [...probes, probes[0]] },
    { probes: [probes[0], ...probes.slice(1).map((x) => ({ ...x, id: probes[0].id }))] },
    { probes: [{ ...probes[0], digest: "ni:///sha-256;incorrect" }, ...probes.slice(1)] },
    { probes: [{ ...probes[0], status: 404 }, ...probes.slice(1)] },
    { probes: [{ ...probes[0], contentType: "text/html" }, ...probes.slice(1)] },
  ]) {
    assert.equal(receivedWeiqiRelease(candidate, { ...observation, ...change }), false,
      `should refuse ${Object.keys(change).join(", ")}`);
  }
  assert.equal(receivedWeiqiRelease(candidate, { ...observation, probes: probes.map((probe) => ({
    ...probe, contentType: `${probe.contentType}; charset=utf-8`,
  })) }), true, "charset parameters cannot change the media-type decision");
});
