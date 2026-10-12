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
import { cohomologyOfRelation } from "@lenticule-science/metrologic/obstruction/cochain";
import { valueOf } from "@red-cup-engineering/computer-data-engine/bilattice-charge";
import { row } from "@lenticule-science/metrologic/articulation/predicating/positing/logic/linear-logic-chu";
import { libertyChuSpace, positionFromSgf, type LibertyChuSpace } from "./derive-liberty-chu-space.mts";
import type { Position } from "@red-cup-engineering/weiqi-engine";

export interface NerveCell {
  subject: string;
  predicate: string;
  object: string;
}

export interface SharedLibertyNerve {
  size: number;
  groups: number;
  groupsInNerve: number;
  sharedLiberties: string[];
  cells: NerveCell[];
  sameColorCells: number;
  oppositeColorCells: number;
  components: number;
  h1: number;
}

/** The nerve's 1-skeleton: one cell per pair of groups sharing an empty point. */
export function nerveCells(derived: LibertyChuSpace): { cells: NerveCell[]; sharedLiberties: string[] } {
  const cells: NerveCell[] = [];
  const sharedLiberties: string[] = [];
  for (const point of derived.points) {
    const served = row(derived.space, point).filter((c) => valueOf(c.charge).name === "potential").map((c) => c.state);
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
export function sharedLibertyNerve(position: Position): SharedLibertyNerve {
  const derived = libertyChuSpace(position);
  const { cells, sharedLiberties } = nerveCells(derived);
  const colour = new Map(derived.groups.map((g) => [g.id, g.color]));
  const sameColorCells = cells.filter((c) => colour.get(c.subject) === colour.get(c.object)).length;
  const cohomology = cohomologyOfRelation(cells);
  return {
    size: derived.size,
    groups: derived.groups.length,
    groupsInNerve: cohomology.entities.length,
    sharedLiberties,
    cells,
    sameColorCells,
    oppositeColorCells: cells.length - sameColorCells,
    components: cohomology.H0.rank,
    h1: cohomology.H1.rank,
  };
}

function isEntrypoint(metaUrl: string): boolean {
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
