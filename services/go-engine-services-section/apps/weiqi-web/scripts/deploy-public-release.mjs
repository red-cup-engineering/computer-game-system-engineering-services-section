import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { activeWorkerVersion } from "./worker-deployments.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const baseline = await readActiveWorkerVersion();
const revision = await command("git", ["rev-parse", "HEAD"]);
const repository = await command("git", ["remote", "get-url", "origin"]);

await command("npx", ["--no-install", "wrangler", "deploy"], { echo: true });
const deployed = await readActiveWorkerVersion();
if (deployed === baseline) throw new Error(`Cloudflare Worker version did not change from ${baseline}`);

const status = await command(process.execPath, ["scripts/verify-public-release.mjs"], {
  echo: true,
  env: {
    ...process.env,
    SOURCE_REPOSITORY: repository,
    SOURCE_REVISION: revision,
    BASELINE_PROVIDER_VERSION: baseline,
    DEPLOYED_PROVIDER_VERSION: deployed,
  },
});
if (!status) throw new Error("public receiver verification did not emit a receipt");

async function readActiveWorkerVersion() {
  const deployments = JSON.parse(await command("npx", ["--no-install", "wrangler", "deployments", "list", "--json"]));
  return activeWorkerVersion(deployments);
}

function command(executable, args, { echo = false, env = process.env } = {}) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(executable, args, { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { const text = chunk.toString(); stdout += text; if (echo) process.stdout.write(text); });
    child.stderr.on("data", (chunk) => { const text = chunk.toString(); stderr += text; if (echo) process.stderr.write(text); });
    child.once("error", rejectCommand);
    child.once("exit", (code) => code === 0 ? resolveCommand(stdout.trim()) : rejectCommand(new Error(`${executable} ${args.join(" ")} failed (${code}): ${stderr.trim()}`)));
  });
}
