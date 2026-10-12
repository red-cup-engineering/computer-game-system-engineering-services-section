#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { projectGameStatusLine } from "../src/status-line.mjs";

export { projectGameStatusLine };
if (import.meta.main) {
  const input = JSON.parse(readFileSync(0, "utf8"));
  process.stdout.write(`${projectGameStatusLine(input.play ?? null, input.openWork)}\n`);
}
