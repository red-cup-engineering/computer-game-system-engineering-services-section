#!/usr/bin/env node
import { projectGamePosition } from "../src/game-position.mjs";
import { runJavascriptNodeOperation } from "../../../../../../computer-code-engineering-services-section/services/javascript-engineering-services-section/services/javascript-node-services-section/src/operation.mjs";

export function readGamePosition(document) {
  return projectGamePosition(document.work, document.ledger, document, { generatedAt: document.generatedAt });
}

if (import.meta.main) {
  const result = await runJavascriptNodeOperation({ name: "read-game-position", description: "readGamePosition — the read-game-position operation.", operation: readGamePosition }, { arguments: process.argv.slice(2), standardInput: process.stdin, standardOutput: process.stdout });
  process.exitCode = result.exitCode;
}
