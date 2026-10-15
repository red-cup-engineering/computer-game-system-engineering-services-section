#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createGtpSession, play, genmove, quit } from "../src/go-engine.mjs";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-operation-engineering-services-section/operation";

/**
 * Send one `play` or `genmove` command to a GTP engine subprocess and return its reply.
 *
 * Spawns `engineCommand`, opens a GTP session on its stdio, sends `play color
 * vertex` when `vertex` is given or `genmove color` otherwise, then quits and
 * closes the session. The subprocess's stderr is inherited so engine
 * diagnostics reach the caller's terminal.
 * @param {{engineCommand: string, engineArgs?: string[], color: string, vertex?: string}} options
 * @returns {Promise<string>} the GTP result text (the empty string for `play`; the chosen vertex, "pass", or "resign" for `genmove`)
 */
export async function playGtpMove({ engineCommand, engineArgs = [], color, vertex }) {
  const child = spawn(engineCommand, engineArgs, { stdio: ["pipe", "pipe", "inherit"] });
  const session = createGtpSession(child);
  try {
    return vertex ? await play(session, color, vertex) : await genmove(session, color);
  } finally {
    await quit(session).catch(() => {});
    session.close();
    child.kill();
  }
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "play-gtp-move", description: "Send one `play` or `genmove` command to a GTP engine subprocess and return its reply.", operation: playGtpMove }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
