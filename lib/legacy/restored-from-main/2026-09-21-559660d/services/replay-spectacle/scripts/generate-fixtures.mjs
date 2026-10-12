#!/usr/bin/env node
// scripts/generate-fixtures — plays real runs through both vendored engines (scripts/play-*.mjs)
// and writes the resulting replay bundles to fixtures/. Re-run this any time to regenerate the
// fixtures from scratch; nothing under fixtures/ is hand-authored except the two `rejected-*`
// bundles, which exist specifically to exercise the rejection path and are labeled as such.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { playRuinfoldDaily } from "./play-ruinfold.mjs";
import { playCrucibleCertified, playCrucibleNaive } from "./play-crucible.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUINFOLD_DIR = path.join(ROOT, "fixtures", "ruinfold");
const CRUCIBLE_DIR = path.join(ROOT, "fixtures", "crucible");

async function writeJson(dir, name, value) {
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
  console.log("wrote", path.relative(ROOT, file));
}

async function main() {
  // --- ruinfold: real played runs -----------------------------------------------------------
  {
    const date = "2026-08-19";
    const { log } = playRuinfoldDaily(date, "wanderer-daily01");
    await writeJson(RUINFOLD_DIR, "2026-08-19-daily.json", { date, log });
  }
  {
    const date = "2026-07-04";
    const { log } = playRuinfoldDaily(date, "wanderer-deepdive");
    await writeJson(RUINFOLD_DIR, "2026-07-04-deeper.json", { date, log });
  }
  {
    // Hand-built, deliberately malformed — exercises the REJECTION path (run.mts's "bad-order"
    // structural check). Not a played run on purpose: there is no real play that produces an
    // out-of-order move log, since a live client can only ever append forward in time.
    const date = "2026-08-19";
    const log = {
      schema: "ruinfold-run/1",
      date,
      seed: 0,
      actor: "wanderer-tamper",
      mode: "scored",
      moves: [
        { tick: 0, seq: 0, intent: { kind: "join", actor: "wanderer-tamper" } },
        { tick: 3, seq: 0, intent: { kind: "move", actor: "wanderer-tamper", dir: "n" } },
        { tick: 2, seq: 0, intent: { kind: "move", actor: "wanderer-tamper", dir: "n" } },
      ],
    };
    await writeJson(RUINFOLD_DIR, "rejected-bad-order.json", { date, log });
  }

  // --- crucible: real played runs -----------------------------------------------------------
  {
    const date = "2026-08-19";
    const { moveLog } = playCrucibleCertified(date);
    await writeJson(CRUCIBLE_DIR, "2026-08-19-certified.json", { date, moveLog });
  }
  {
    const date = "2026-08-19";
    const { moveLog } = playCrucibleNaive(date);
    await writeJson(CRUCIBLE_DIR, "2026-08-19-naive.json", { date, moveLog });
  }
  {
    const date = "2026-07-04";
    const { moveLog } = playCrucibleNaive(date, { wastedMerges: 1 });
    await writeJson(CRUCIBLE_DIR, "2026-07-04-naive.json", { date, moveLog });
  }
  {
    // Hand-built, deliberately illegal — exercises the REJECTION path (engine.mts#applyMove
    // throwing on an out-of-legality move). Not a played run on purpose.
    const date = "2026-08-19";
    const moveLog = [{ move: { verb: "split", bondId: "bond-does-not-exist", mode: "clean" } }];
    await writeJson(CRUCIBLE_DIR, "rejected-illegal-move.json", { date, moveLog });
  }
}

await main();
