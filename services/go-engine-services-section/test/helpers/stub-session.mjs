// Test-only process fixture shared by GTP and KataGo-analysis adapter tests.
// Each case owns its own subprocess. Always release stdin and await the
// child's exit, including when an assertion or engine request rejects.
// No sockets, timers, shared global engine or external KataGo installation.
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";

const STUB = fileURLToPath(new URL("../stub-engine.mjs", import.meta.url));

export async function withStubSession(mode, createSession, run, { finish } = {}) {
  if (mode !== "gtp" && mode !== "analysis") {
    throw new TypeError(`Unsupported stub protocol: ${mode}`);
  }
  const child = spawn(process.execPath, [STUB, mode], {
    stdio: ["pipe", "pipe", "inherit"],
  });
  let session;
  try {
    session = createSession(child);
    const result = await run(session);
    if (finish) await finish(session);
    return result;
  } finally {
    session?.close();
    if (child.exitCode === null && child.signalCode === null) {
      // Register BEFORE killing, so a fast exit cannot be missed.
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
}
