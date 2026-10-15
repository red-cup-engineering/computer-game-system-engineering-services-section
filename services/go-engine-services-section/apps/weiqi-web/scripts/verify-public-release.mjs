import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { observePublicRelease } from "@red-cup-engineering/web-release-candidate-service";

import { createWeiqiPublicRelease, publicWeiqiOrigins, receivedWeiqiRelease } from "./public-release-contract.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const requiredEnvironment = ["SOURCE_REPOSITORY", "SOURCE_REVISION", "BASELINE_PROVIDER_VERSION", "DEPLOYED_PROVIDER_VERSION"];
const missing = requiredEnvironment.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`public receiver verification requires ${missing.join(", ")}`);
const publicRoot = resolve(ROOT, "public");
const artifactFiles = await publicArtifacts(publicRoot);
const wrangler = JSON.parse(await readFile(resolve(ROOT, "wrangler.jsonc"), "utf8"));
// Observe every host in the real Worker configuration. No locally constructed
// "active receipt" is a substitute for Cloudflare state or live customer bytes.
const checked = await Promise.all(publicWeiqiOrigins(wrangler).map(async (origin) => {
  const release = createWeiqiPublicRelease({
    artifacts: artifactFiles,
    repository: process.env.SOURCE_REPOSITORY,
    revision: process.env.SOURCE_REVISION,
    wrangler,
    baselineVersion: process.env.BASELINE_PROVIDER_VERSION,
    origin,
  });
  const observation = await observePublicRelease({
    release,
    observer: "weiqi-web-public-release-observer",
    observedAt: new Date().toISOString(),
    fetch: globalThis.fetch,
  });
  return {
    origin,
    received: receivedWeiqiRelease(release, observation),
    releaseDigest: release.digest,
    observation,
  };
}));
const received = checked.every((host) => host.received);
process.stdout.write(`${JSON.stringify({
  kind: "weiqi-public-http-receiving",
  received,
  // This version comes from Wrangler's independent deployment listing.
  // It is NOT a fabricated provider receipt or proof of the host's DNS binding.
  providerReportedVersion: process.env.DEPLOYED_PROVIDER_VERSION,
  hosts: checked,
}, null, 2)}\n`);
if (!received) process.exitCode = 1;
async function publicArtifacts(root, relative = "") {
  const entries = await readdir(resolve(root, relative), { withFileTypes: true });
  const nested = await Promise.all(entries.sort((left, right) => left.name.localeCompare(right.name)).map(async (entry) => {
    const path = relative ? `${relative}/${entry.name}` : entry.name;
    return entry.isDirectory() ? publicArtifacts(root, path) : [[path, await readFile(resolve(root, path))]];
  }));
  return nested.flat();
}
