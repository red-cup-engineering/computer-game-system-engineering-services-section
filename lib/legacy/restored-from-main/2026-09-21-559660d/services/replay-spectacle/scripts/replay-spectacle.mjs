#!/usr/bin/env node
// replay-spectacle <game> <replay.json> — reads a replay bundle from disk, verifies + renders it
// through the named game's adapter, and writes the finished, self-contained HTML page to stdout.
// Same stdin/stdout-pipeline convention as TUFTE's own `render-tufte-document` CLI (see its
// README): `replay-spectacle ruinfold run.json > page.html`.

import process from "node:process";
import { readFile } from "node:fs/promises";
import { renderReplayPage } from "../src/render-replay-page.mjs";

const ADAPTERS = {
  ruinfold: () => import("../adapters/ruinfold.mjs"),
  crucible: () => import("../adapters/crucible.mjs"),
};

function usage() {
  return `usage: replay-spectacle <${Object.keys(ADAPTERS).join("|")}> <replay.json>\n`;
}

async function main(argv) {
  const [game, replayPath] = argv;
  if (!game || !replayPath) {
    process.stderr.write(usage());
    return 2;
  }
  const load = ADAPTERS[game];
  if (!load) {
    process.stderr.write(`replay-spectacle: unknown game "${game}"\n${usage()}`);
    return 2;
  }

  let replayBundle;
  try {
    replayBundle = JSON.parse(await readFile(replayPath, "utf8"));
  } catch (error) {
    process.stderr.write(`replay-spectacle: could not read/parse ${replayPath}: ${error.message}\n`);
    return 1;
  }

  const gameAdapter = (await load()).default;
  try {
    process.stdout.write(renderReplayPage(gameAdapter, replayBundle));
  } catch (error) {
    process.stderr.write(`replay-spectacle: ${error.message}\n`);
    return 1;
  }
  return 0;
}

process.exitCode = await main(process.argv.slice(2));
