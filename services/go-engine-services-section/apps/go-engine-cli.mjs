#!/usr/bin/env node
import { playGtpMove } from "../scripts/play-gtp-move.mjs";
import { queryAnalysis } from "../scripts/query-analysis.mjs";
import { deriveReadoutEnvelope } from "../scripts/derive-readout-envelope.mjs";

const USAGE = `usage:
  go-engine-cli.mjs play <engine-command> <color> <vertex>
  go-engine-cli.mjs genmove <engine-command> <color>
  go-engine-cli.mjs analyze <engine-command> <query-json>
  go-engine-cli.mjs envelope <analysis-response-json>`;

/**
 * Compose the GTP play/genmove, KataGo analysis-query, and readout-envelope
 * scripts into one CLI face.
 * @param {string[]} argv - `process.argv.slice(2)`-shaped arguments
 * @returns {Promise<void>}
 */
/** "gnugo --mode gtp" -> { engineCommand: "gnugo", engineArgs: ["--mode", "gtp"] }. */
function splitEngineSpec(spec) {
  const [engineCommand, ...engineArgs] = String(spec ?? "").trim().split(/\s+/);
  return { engineCommand, engineArgs };
}

export async function runGoEngineCli(argv) {
  const [command, ...rest] = argv;
  switch (command) {
    case "play": {
      const [engineSpec, color, vertex] = rest;
      console.log(await playGtpMove({ ...splitEngineSpec(engineSpec), color, vertex }));
      return;
    }
    case "genmove": {
      const [engineSpec, color] = rest;
      console.log(await playGtpMove({ ...splitEngineSpec(engineSpec), color }));
      return;
    }
    case "analyze": {
      const [engineSpec, queryJson] = rest;
      console.log(JSON.stringify(await queryAnalysis({ ...splitEngineSpec(engineSpec), query: JSON.parse(queryJson) })));
      return;
    }
    case "envelope": {
      const [analysisResponseJson] = rest;
      console.log(JSON.stringify(deriveReadoutEnvelope(JSON.parse(analysisResponseJson))));
      return;
    }
    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runGoEngineCli(process.argv.slice(2)).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}
