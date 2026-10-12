import assert from "node:assert/strict";
import test from "node:test";

import { decidePublicRelease } from "@red-cup-engineering/web-release-candidate-service";
import { createWeiqiPublicRelease, WEIQI_PUBLIC_PROBES } from "../scripts/public-release-contract.mjs";

test("the public release contract binds Study Replay and the shared browser engine to Weiqi's static receiver", () => {
  const artifacts = new Map([
    ["index.html", "home"], ["play.html", "play"], ["review.html", "study"],
    ["js/kernel/index.mjs", "engine"], ["js/review-app.mjs", "review"],
    ["manifest.webmanifest", "manifest"], ["sw.js", "worker"],
  ]);
  const release = createWeiqiPublicRelease({
    artifacts,
    repository: "https://example.test/561-group/info",
    revision: "abc123",
    wrangler: { name: "weiqi-561-group", assets: { directory: "./public" }, routes: [{ pattern: "weiqi.561.group", custom_domain: true }] },
    baselineVersion: "before",
  });

  assert.equal(release.channel.stateClass, "edge-static");
  assert.deepEqual(release.channel.probes, WEIQI_PUBLIC_PROBES);
  assert.equal(release.target.receiver, "worker:weiqi-561-group");
  assert.equal(release.artifact.manifest.artifactCount, artifacts.size);
  assert.deepEqual(
    Object.fromEntries(release.channel.probes.map((probe) => [probe.id, probe.contentType])),
    {
      "browser-engine": "text/javascript",
      home: "text/html",
      play: "text/html",
      "study-client": "text/javascript",
      "study-replay": "text/html",
      manifest: "application/manifest+json",
      "service-worker": "text/javascript",
    },
  );

  const receipt = {
    kind: "public-release-receipt", version: 1, releaseDigest: release.digest,
    provider: release.target.provider, receiver: release.target.receiver,
    artifactManifestDigest: release.artifact.manifestDigest, configDigest: release.target.configDigest,
    bindingDigest: release.target.bindingDigest, providerVersion: "after", routeDigest: release.snapshot.routeDigest,
    baselineProviderVersion: release.snapshot.providerVersion, baselineRouteDigest: release.snapshot.routeDigest,
    canonicalOrigin: release.channel.canonicalOrigin,
  };
  const observation = {
    kind: "public-release-observation", version: 1, releaseDigest: release.digest, independent: true,
    observer: "external", origin: release.channel.canonicalOrigin, observedAt: "2026-09-10T01:00:00Z",
    probes: release.channel.probes.map((probe) => ({
      id: probe.id, status: probe.expectedStatus,
      contentType: probe.contentType,
      digest: release.artifact.manifest.artifacts.find((artifact) => artifact.path === probe.artifactPath)?.digest,
    })),
  };
  assert.equal(decidePublicRelease({ release, activeReceipt: receipt, receiverObservation: observation }).disposition, "no-op");
});
