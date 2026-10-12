/**
 * `@emsenn/fizzos/fields` — scalar fields that diffuse across the world graph, on the exact
 * spectral geometry of `@emsenn/relating`.
 *
 * The rooms of the world, joined by their exits, form a graph; that graph carries a
 * combinatorial **Laplacian** `L = D − W`, and relating computes it exactly (Integer
 * carriers, no float crosses that surface), along with its exact spectral invariants — the
 * zero-eigenvalue multiplicity (how many disconnected regions) and the weighted spanning-tree
 * count (a region's connective resilience). FizzOS reads relating's **exact** Laplacian once,
 * then runs heat flow with it: the deviation operator `(Lf)(x) = Σ w(x,y)·(f(x) − f(y))` moves
 * a quantity at a room toward its neighbours, so a **field** — pollution, scent, rumour,
 * light — spreads by `f' = f − rate·Lf`, conserving its total (L's rows sum to zero) and
 * settling to a harmonic equilibrium (uniform within each connected region).
 *
 * The operator and the structural invariants are relating's exact mathematics; only the
 * ergonomic field values (per-room reals) are floats. Fields are not bespoke spread loops —
 * they are heat flow on the world's own connectivity, derived from an exactly-computed
 * Laplacian.
 */
import { mark, token } from "@emsenn/relating";
import { type RelationGraphCarrier, componentCount, laplacianOf, treeCount } from "@emsenn/relating/analysis";
import { fromInts, toCount, toInt } from "@emsenn/relating/writing";

/** The world graph as relating sees it, with its exact Laplacian read down to a number matrix. */
export interface WorldGraph {
  readonly roomIds: readonly string[];
  readonly index: ReadonlyMap<string, number>;
  readonly graph: RelationGraphCarrier;
  /** L = D − W, read once from relating's exact Integer Laplacian into JS integers. */
  readonly laplacian: readonly (readonly number[])[];
}

/**
 * Build the world graph from a room→neighbours adjacency. Edges are undirected and weighted
 * by multiplicity; self-loops are dropped (the Laplacian ignores them). The Laplacian itself
 * is computed exactly by relating, then read once into a number matrix for fast diffusion.
 */
export function worldGraph(adjacency: Readonly<Record<string, readonly string[]>>): WorldGraph {
  const roomIds = Object.keys(adjacency);
  const index = new Map(roomIds.map((id, i) => [id, i] as const));
  const n = roomIds.length;
  const w: number[][] = roomIds.map(() => new Array(n).fill(0));
  for (const [room, neighbours] of Object.entries(adjacency)) {
    const i = index.get(room)!;
    for (const dest of neighbours) {
      const j = index.get(dest);
      if (j === undefined || j === i) continue;
      w[i]![j]! = 1;
      w[j]![i]! = 1; // symmetrise: diffusion flows both ways across an exit
    }
  }
  const graph: RelationGraphCarrier = Object.freeze({
    kind: "meme-analysis.laplacian.graph" as const,
    terms: Object.freeze(roomIds.map((id) => token(mark(id)))),
    weights: fromInts(w),
  });
  // Read relating's EXACT Integer Laplacian once into JS integers for the hot diffusion loop.
  const laplacian = Object.freeze(laplacianOf(graph).map((row) => Object.freeze(row.map((entry) => toInt(entry)))));
  return Object.freeze({ roomIds, index, graph, laplacian });
}

/** The exact Laplacian deviation `Lf` at each room — heat flow's instantaneous gradient. */
export function deviation(wg: WorldGraph, field: Readonly<Record<string, number>>): number[] {
  const f = wg.roomIds.map((id) => field[id] ?? 0);
  return wg.laplacian.map((row) => row.reduce((sum, entry, j) => sum + entry * f[j]!, 0));
}

/**
 * One diffusion step: `f' = f − rate·Lf`, with `Lf` relating's exact Laplacian deviation.
 * Total field mass is conserved (the Laplacian's rows sum to zero); the field flows from full
 * rooms to empty neighbours. `rate` must be ≤ 1/max-degree for stability — the default 0.2 is
 * safe for the small-degree room graphs of a MUD.
 */
export function diffuse(wg: WorldGraph, field: Readonly<Record<string, number>>, rate = 0.2): Record<string, number> {
  const lf = deviation(wg, field);
  const next: Record<string, number> = {};
  wg.roomIds.forEach((id, i) => { next[id] = (field[id] ?? 0) - rate * lf[i]!; });
  return next;
}

/** Whether a field has settled to equilibrium — harmonic (`Lf ≈ 0`), uniform within each region. */
export function atEquilibrium(wg: WorldGraph, field: Readonly<Record<string, number>>, tolerance = 1e-9): boolean {
  return deviation(wg, field).every((d) => Math.abs(d) <= tolerance);
}

/** The number of disconnected regions of the world — the multiplicity of L's zero eigenvalue (exact). */
export function regionCount(wg: WorldGraph): number {
  return toCount(componentCount(wg.graph));
}

/** A region's connective resilience: the weighted spanning-tree count (exact; 0 when disconnected). */
export function connectivity(wg: WorldGraph): number {
  return toInt(treeCount(wg.graph));
}
