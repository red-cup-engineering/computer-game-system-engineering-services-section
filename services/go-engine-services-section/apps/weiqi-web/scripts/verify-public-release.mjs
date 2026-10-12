import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  decidePublicRelease,
  observePublicRelease,
} from "@red-cup-engineering/web-release-candidate-service";

import { createWeiqiPublicRelease } from "./public-release-contract.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const requiredEnvironment = ["SOURCE_REPOSITORY", "SOURCE_REVISION", "BASELINE_PROVIDER_VERSION", "DEPLOYED_PROVIDER_VERSION"];
const missing = requiredEnvironment.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`public receiver verification requires ${missing.join(", ")}`);
const publicRoot = resolve(ROOT, "public");
const artifactFiles = await publicArtifacts(publicRoot);
const wrangler = JSON.parse(await readFile(resolve(ROOT, "wrangler.jsonc"), "utf8"));
const release = createWeiqiPublicRelease({
  artifacts: artifactFiles,
  repository: process.env.SOURCE_REPOSITORY,
  revision: process.env.SOURCE_REVISION,
  wrangler,
  baselineVersion: process.env.BASELINE_PROVIDER_VERSION,
});
const observation = await observePublicRelease({
  release,
  observer: "weiqi-web-public-release-observer",
  observedAt: new Date().toISOString(),
  fetch: globalThis.fetch,
});
const receipt = observation.kind === "public-release-observation" ? {
  kind: "public-release-receipt",
  version: 1,
  releaseDigest: release.digest,
  provider: release.target.provider,
  receiver: release.target.receiver,
  artifactManifestDigest: release.artifact.manifestDigest,
  configDigest: release.target.configDigest,
  bindingDigest: release.target.bindingDigest,
  providerVersion: process.env.DEPLOYED_PROVIDER_VERSION,
  routeDigest: release.snapshot.routeDigest,
  baselineProviderVersion: release.snapshot.providerVersion,
  baselineRouteDigest: release.snapshot.routeDigest,
  canonicalOrigin: release.channel.canonicalOrigin,
} : null;
const decision = receipt === null ? null : decidePublicRelease({ release, activeReceipt: receipt, receiverObservation: observation });
process.stdout.write(`${JSON.stringify({ release, receipt, observation, decision }, null, 2)}\n`);
if (observation.kind === "public-release-observation-refusal" || decision?.disposition !== "no-op") process.exitCode = 1;

async function publicArtifacts(root, relative = "") {
  const entries = await readdir(resolve(root, relative), { withFileTypes: true });
  const nested = await Promise.all(entries.sort((left, right) => left.name.localeCompare(right.name)).map(async (entry) => {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    return entry.isDirectory() ? publicArtifacts(root, path) : [[path, await readFile(resolve(root, path))]];
  }));
  return nested.flat();
}
