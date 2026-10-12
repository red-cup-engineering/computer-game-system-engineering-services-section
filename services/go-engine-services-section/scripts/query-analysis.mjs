#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createAnalysisSession } from "../src/go-engine.mjs";
import { runJavascriptNodeOperation } from "@red-cup-engineering/javascript-node-services-section/operation";

/**
 * Send one KataGo JSON analysis query to an engine subprocess and return its response.
 *
 * Spawns `engineCommand` (typically `katago analysis -config ... -model ...`),
 * opens an analysis session on its stdio, sends `query`, and returns the first
 * response matching its id. The subprocess's stderr is inherited so engine
 * diagnostics reach the caller's terminal.
 * @param {{engineCommand: string, engineArgs?: string[], query: object}} options
 * @returns {Promise<object>} the parsed JSON analysis response
 */
export async function queryAnalysis({ engineCommand, engineArgs = [], query }) {
  const child = spawn(engineCommand, engineArgs, { stdio: ["pipe", "pipe", "inherit"] });
  const session = createAnalysisSession(child);
  try {
    return await session.query(query);
  } finally {
    session.close();
    child.kill();
  }
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "query-analysis", description: "Send one KataGo JSON analysis query to an engine subprocess and return its response.", operation: queryAnalysis }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
