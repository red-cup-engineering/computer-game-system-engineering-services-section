// Derive the shared-liberty nerve: vertices are groups, one cell per pair
// sharing an empty point; H^0/H^1 read combinatorially by metrologic
// (rank H^1 = cells - groups + components). Adjacency coordination only —
// cannot see a ladder breaker, a stone deciding a distant group's status
// while sharing no liberty with it. Candidate 1 (obsmetrologia-and-go-
// strategy.md) still needs edges by readout pullback, tested on that breaker.
// Run with: node scripts/derive-shared-liberty-nerve.mts --sgf <file> [--move <n>]
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { cohomologyOfCells } from "@red-cup-engineering/signgraph/cohomology";
import { row } from "@red-cup-engineering/metrologic/chu";
import { libertyChuSpace, positionFromSgf } from "./derive-liberty-chu-space.mjs";

/** The nerve's 1-skeleton: one cell per pair of groups sharing an empty point. */
export function nerveCells(derived) {
  const cells = [];
  const sharedLiberties = [];
  for (const point of derived.points) {
    const served = row(derived.space, point).filter((c) => c.reading === "potential").map((c) => c.state);
    if (served.length < 2) continue;
    sharedLiberties.push(point);
    for (let i = 0; i < served.length; i += 1) {
      for (let j = i + 1; j < served.length; j += 1) {
        cells.push({ subject: served[i], predicate: `shares-liberty:${point}`, object: served[j] });
      }
    }
  }
  return { cells, sharedLiberties };
}

/** The shared-liberty nerve of a position with its cohomology read off the graph. */
export function sharedLibertyNerve(position) {
  const derived = libertyChuSpace(position);
  const { cells, sharedLiberties } = nerveCells(derived);
  const colour = new Map(derived.groups.map((g) => [g.id, g.color]));
  const sameColorCells = cells.filter((c) => colour.get(c.subject) === colour.get(c.object)).length;
  const cohomology = cohomologyOfCells(cells);
  return {
    size: derived.size,
    groups: derived.groups.length,
    groupsInNerve: cohomology.entities.length,
    sharedLiberties,
    cells,
    sameColorCells,
    oppositeColorCells: cells.length - sameColorCells,
    components: cohomology.zeroCohomology.rank,
    h1: cohomology.firstCohomology.rank,
  };
}

function isEntrypoint(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(metaUrl));
  } catch {
    return false;
  }
}

if (isEntrypoint(import.meta.url)) {
  const { values } = parseArgs({ options: { sgf: { type: "string" }, move: { type: "string" } } });
  if (!values.sgf) {
    console.error("usage: node scripts/derive-shared-liberty-nerve.mts --sgf <file> [--move <n>]");
    process.exitCode = 2;
  } else {
    const { position, moveIndex } = positionFromSgf(readFileSync(values.sgf, "utf8"), values.move === undefined ? undefined : Number(values.move));
    const nerve = sharedLibertyNerve(position);
    process.stdout.write(`${JSON.stringify({ type: "weiqi.shared-liberty-nerve", moveIndex, ...nerve }, null, 2)}\n`);
  }
}
